import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/access/management", () => ({
  readManagementProjects: vi.fn(),
  readManagementHierarchy: vi.fn(),
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { getCurrentUser } from "@/lib/auth/session";
import { readManagementHierarchy, readManagementProjects } from "@/lib/access/management";
import { GET } from "./route";
import { GET as detail } from "./[projectId]/route";
const id = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const context = (projectId = id) => ({ params: Promise.resolve({ projectId }) });
const request = (query = "") =>
  new Request(`https://example.test/api/management/projects${query}`, {
    headers: { "x-user-id": "forged" },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
});
function privateResponse(r: Response, status: number) {
  expect(r.status).toBe(status);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Vary")).toBe("Cookie");
}
it("requires the verified identity and ignores supplied identity and role claims", async () => {
  vi.mocked(readManagementProjects).mockResolvedValue({
    projects: [],
    page: 1,
    hasNext: false,
    canCreateProject: false,
    hasManagementAccess: false,
  });
  privateResponse(await GET(request("?userId=forged&admin=true&page=2")), 200);
  expect(readManagementProjects).toHaveBeenCalledWith({}, "verified", 2);
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  privateResponse(await GET(request()), 401);
  privateResponse(await detail(request(), context()), 401);
});
it.each(["0", "-1", "1.5", "10001", "bad"])("rejects invalid discovery page %s", async (page) => {
  privateResponse(await GET(request(`?page=${page}`)), 400);
  expect(readManagementProjects).not.toHaveBeenCalled();
});
it("makes invalid, nonexistent and unauthorized identifiers indistinguishable", async () => {
  vi.mocked(readManagementHierarchy).mockResolvedValue(null);
  for (const value of ["", "invalid", id]) {
    const response = await detail(request(), context(value));
    privateResponse(response, 404);
    expect(await response.json()).toEqual({ error: "NOT_FOUND" });
  }
  expect(readManagementHierarchy).toHaveBeenCalledExactlyOnceWith({}, "verified", id);
});
it("keeps successful detail and all server failures private without leaking exception details", async () => {
  vi.mocked(readManagementHierarchy).mockResolvedValue({
    id,
    name: "Project",
    city: null,
    buildings: [],
    canAddBuilding: false,
    counts: { buildings: 0, floors: 0, apartments: 0 },
  });
  privateResponse(await detail(request(), context()), 200);
  for (const call of [() => GET(request()), () => detail(request(), context())]) {
    vi.mocked(readManagementHierarchy).mockRejectedValue(new Error("database secret"));
    vi.mocked(readManagementProjects).mockRejectedValue(new Error("database secret"));
    const response = await call();
    privateResponse(response, 500);
    expect(await response.json()).toEqual({ error: "INTERNAL_ERROR" });
  }
});
