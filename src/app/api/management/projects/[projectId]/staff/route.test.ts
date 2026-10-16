import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => ({ baseURL: "https://staff.test" }) }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/access/staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access/staff")>()),
  assignProjectStaff: vi.fn(),
  readProjectStaff: vi.fn(),
  revokeProjectStaff: vi.fn(),
}));
import { getCurrentUser } from "@/lib/auth/session";
import {
  assignProjectStaff,
  readProjectStaff,
  revokeProjectStaff,
  StaffError,
} from "@/lib/access/staff";
import { GET, POST } from "./route";
import { DELETE } from "./[assignmentId]/route";
const id = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const context = { params: Promise.resolve({ projectId: id }) };
const deletion = { params: Promise.resolve({ projectId: id, assignmentId: id }) };
const input = { email: "registered@example.test", role: "project_manager", buildingId: null };
function request(
  body: string = JSON.stringify(input),
  type = "application/json",
  origin = "https://staff.test",
) {
  return new Request("https://staff.test/api?userId=forged&admin=true", {
    method: "POST",
    headers: { "content-type": type, origin, "x-user-id": "forged" },
    body,
  });
}
function check(r: Response, status: number) {
  expect(r.status).toBe(status);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Vary")).toBe("Cookie");
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
});
it("passes only verified identity and validated inputs to staff services", async () => {
  vi.mocked(assignProjectStaff).mockResolvedValue({ assignmentId: id });
  check(await POST(request(), context), 201);
  expect(assignProjectStaff).toHaveBeenCalledExactlyOnceWith({}, "verified", id, input);
  vi.mocked(revokeProjectStaff).mockResolvedValue({ removed: true });
  check(await DELETE(request(), deletion), 200);
  expect(revokeProjectStaff).toHaveBeenCalledExactlyOnceWith({}, "verified", id, id);
});
it("keeps anonymous and forbidden responses private", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  for (const call of [GET, POST]) check(await call(request(), context), 401);
  check(await DELETE(request(), deletion), 401);
  expect(assignProjectStaff).not.toHaveBeenCalled();
});
it.each([
  ["{", "application/json", 400],
  ["{}", "text/plain", 415],
  [JSON.stringify({ ...input, email: "x".repeat(5000) }), "application/json", 413],
  [JSON.stringify({ ...input, role: "admin" }), "application/json", 400],
  [JSON.stringify({ ...input, userId: "forged" }), "application/json", 400],
] as const)("rejects malformed/oversized/forged bodies", async (body, type, status) => {
  check(await POST(request(body, type), context), status);
  expect(assignProjectStaff).not.toHaveBeenCalled();
});
it("rejects missing and foreign write origins", async () => {
  for (const origin of ["", "https://evil.test"]) {
    check(await POST(request(undefined, undefined, origin), context), 403);
    check(await DELETE(request(undefined, undefined, origin), deletion), 403);
  }
  expect(assignProjectStaff).not.toHaveBeenCalled();
  expect(revokeProjectStaff).not.toHaveBeenCalled();
});
it("bounds discovery pagination and makes invalid identifiers unavailable", async () => {
  for (const page of ["0", "1.5", "10001", "bad"])
    check(await GET(new Request(`https://staff.test/api?page=${page}`), context), 400);
  expect(readProjectStaff).not.toHaveBeenCalled();
  for (const value of ["", "bad"]) {
    check(await GET(request(), { params: Promise.resolve({ projectId: value }) }), 404);
    check(
      await DELETE(request(), { params: Promise.resolve({ projectId: id, assignmentId: value }) }),
      404,
    );
  }
});
it("does not leak server errors and preserves expected authorization/conflict statuses", async () => {
  for (const error of [
    new StaffError(403, "FORBIDDEN"),
    new StaffError(404, "NOT_FOUND"),
    new StaffError(409, "ALREADY_ASSIGNED"),
    new Error("database secret"),
  ]) {
    vi.mocked(assignProjectStaff).mockRejectedValue(error);
    const r = await POST(request(), context);
    check(r, error instanceof StaffError ? error.status : 500);
    expect(await r.json()).toEqual({
      error: error instanceof StaffError ? error.code : "INTERNAL_ERROR",
    });
  }
});
