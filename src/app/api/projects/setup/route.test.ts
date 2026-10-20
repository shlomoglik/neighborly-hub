import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({
  readAuthConfig: () => ({ baseURL: "https://example.test" }),
}));
vi.mock("@/lib/access/project-setup", () => ({ provisionProjectSetup: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { getCurrentUser } from "@/lib/auth/session";
import { provisionProjectSetup } from "@/lib/access/project-setup";
import { POST } from "./route";
const valid = {
  name: " Community ",
  city: " Sderot ",
  buildings: [{ name: " A ", floors: 2, unitsPerFloor: 3 }],
};
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
function request(body: string = JSON.stringify(valid), headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/projects/setup?userId=forged", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
      "x-user-id": "forged",
      ...headers,
    },
    body,
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(provisionProjectSetup).mockResolvedValue({ projectId });
});
it("rejects anonymous requests before provisioning", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(provisionProjectSetup).not.toHaveBeenCalled();
});
it.each(["", "null", "https://attacker.test", "https://example.test.attacker.test"])(
  "rejects origin %s",
  async (origin) => {
    expect((await POST(request(undefined, { origin }))).status).toBe(403);
    expect(provisionProjectSetup).not.toHaveBeenCalled();
  },
);
it("rejects malformed, unsupported, oversized and invalid input before writes", async () => {
  for (const body of [
    "{",
    "null",
    JSON.stringify({ ...valid, buildings: [] }),
    JSON.stringify({ ...valid, userId: "admin" }),
  ])
    expect((await POST(request(body))).status).toBe(400);
  expect((await POST(request(undefined, { "content-type": "text/plain" }))).status).toBe(415);
  expect((await POST(request("x".repeat(12 * 1024 * 1024 + 1)))).status).toBe(413);
  expect(provisionProjectSetup).not.toHaveBeenCalled();
});
it("uses only verified identity, trims input, and returns the saved project ID", async () => {
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ projectId });
  expect(provisionProjectSetup).toHaveBeenCalledWith({}, "verified", {
    name: "Community",
    city: "Sderot",
    buildings: [{ name: "A", floors: 2, unitsPerFloor: 3 }],
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("returns forbidden when the database grant is missing or revoked", async () => {
  vi.mocked(provisionProjectSetup).mockResolvedValue(null);
  expect((await POST(request())).status).toBe(403);
});
it("never leaks internal errors or reports success after persistence fails", async () => {
  vi.mocked(provisionProjectSetup).mockRejectedValue(new Error("private SQL and credentials"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "SETUP_FAILED" });
});
