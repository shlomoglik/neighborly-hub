import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => ({ baseURL: "https://app.test" }) }));
import { getCurrentUser } from "@/lib/auth/session";
import {
  invitationBody,
  invitationRoute,
  invitationResponse,
  invitationUuid,
} from "./invitation-http";
import { InvitationError } from "./invitations";
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
  const action = vi.fn(async (id) => invitationResponse({ id }));
  const response = await invitationRoute(request(), true, action);
  expect(action).toHaveBeenCalledWith("verified");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
});
it.each([401, 403, 404, 409, 500])("keeps error responses private (%i)", async (code) => {
  if (code === 401) vi.mocked(getCurrentUser).mockResolvedValue(null);
  const response = await invitationRoute(request(), false, async () => {
    if (code === 500) throw new Error("secret detail");
    throw new InvitationError(code, code === 404 ? "NOT_FOUND" : "FAILED");
  });
  expect(response.status).toBe(code);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.text()).not.toContain("secret detail");
});
it("rejects absent/cross-site origin before mutation and missing/invalid IDs uniformly", async () => {
  const action = vi.fn();
  for (const origin of ["https://evil.test", "null", ""])
    expect((await invitationRoute(request(origin), true, action)).status).toBe(403);
  expect(action).not.toHaveBeenCalled();
  expect(() => invitationUuid("bad")).toThrowError(new InvitationError(404, "NOT_FOUND"));
});
it("bounds JSON stream size, rejects malformed/type-mismatched payloads", async () => {
  await expect(invitationBody(request(undefined, "{"))).rejects.toMatchObject({ status: 400 });
  await expect(invitationBody(request(undefined, "{}", "text/plain"))).rejects.toMatchObject({
    status: 415,
  });
  await expect(
    invitationBody(request(undefined, JSON.stringify({ data: "x".repeat(4096) }))),
  ).rejects.toMatchObject({ status: 413 });
  await expect(invitationBody(request())).resolves.toEqual({});
});
