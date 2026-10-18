import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => ({ baseURL: "https://app.test" }) }));
import { getCurrentUser } from "@/lib/auth/session";
import { readHouseholdBody, householdRoute } from "./household-http";
import { managementResponse } from "./management-response";
import { HouseholdError } from "./households";
beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "v@example.test",
    name: "Verified",
  });
});
function request(origin = "https://app.test", body = "{}", type = "application/json") {
  return new Request("https://app.test/api/join/token", {
    method: "POST",
    headers: { origin, "content-type": type, "x-user-id": "forged-admin" },
    body,
  });
}
it("passes only verified session identity and private cache boundaries", async () => {
  const action = vi.fn(async (id) => managementResponse({ id }));
  const response = await householdRoute(request(), null, true, action);
  expect(action).toHaveBeenCalledWith("verified");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
});
it.each([401, 403, 404, 409, 500])("keeps error responses private (%i)", async (code) => {
  if (code === 401) vi.mocked(getCurrentUser).mockResolvedValue(null);
  const response = await householdRoute(request(), null, false, async () => {
    if (code === 500) throw new Error("secret detail");
    throw new HouseholdError(code, code === 404 ? "NOT_FOUND" : "FAILED");
  });
  expect(response.status).toBe(code);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.text()).not.toContain("secret detail");
});
it("rejects absent/cross-site origin before mutation and missing/invalid IDs uniformly", async () => {
  const action = vi.fn();
  for (const origin of ["https://evil.test", "null", ""])
    expect((await householdRoute(request(origin), null, true, action)).status).toBe(403);
  expect(action).not.toHaveBeenCalled();
  expect((await householdRoute(request(), "bad", false, action)).status).toBe(404);
});
it("bounds JSON stream size, rejects malformed/type-mismatched payloads", async () => {
  await expect(readHouseholdBody(request(undefined, "{"))).rejects.toMatchObject({ status: 400 });
  await expect(readHouseholdBody(request(undefined, "{}", "text/plain"))).rejects.toMatchObject({
    status: 415,
  });
  await expect(
    readHouseholdBody(request(undefined, JSON.stringify({ data: "x".repeat(4096) }))),
  ).rejects.toMatchObject({ status: 413 });
  await expect(readHouseholdBody(request())).resolves.toEqual({});
});
