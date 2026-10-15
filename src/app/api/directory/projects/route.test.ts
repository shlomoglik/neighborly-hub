import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/access/projects", () => ({ readDirectoryProjects: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { getCurrentUser } from "@/lib/auth/session";
import { readDirectoryProjects } from "@/lib/access/projects";
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());
it("does not discover projects for an anonymous or forged identity", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  const response = await GET(
    new Request("https://example.test/api/directory/projects?userId=forged", {
      headers: { "x-user-id": "forged" },
    }),
  );
  expect(response.status).toBe(401);
  expect(readDirectoryProjects).not.toHaveBeenCalled();
});
it("uses the current user and returns uncached authorized metadata", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "current",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(readDirectoryProjects).mockResolvedValue([]);
  const response = await GET(new Request("https://example.test/api/directory/projects"));
  expect(readDirectoryProjects).toHaveBeenCalledWith({}, "current");
  expect(await response.json()).toEqual({ projects: [] });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
