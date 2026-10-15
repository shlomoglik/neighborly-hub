import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/access/directory", () => ({ readDirectory: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { getCurrentUser } from "@/lib/auth/session";
import { readDirectory } from "@/lib/access/directory";
import { GET } from "./route";
const id = "6d79eaf5-ab9a-47c0-859a-201ef17bf238";
const call = (projectId = id) =>
  GET(
    new Request(`https://example.test/api/projects/${projectId}/directory?userId=forged`, {
      headers: { "x-user-id": "forged" },
    }),
    { params: Promise.resolve({ projectId }) },
  );
beforeEach(() => vi.resetAllMocks());
it("returns private uncached 401 before reading any data", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  const response = await call();
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(readDirectory).not.toHaveBeenCalled();
});
it("hides missing and forbidden projects with the same 404", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(readDirectory).mockResolvedValue(null);
  expect((await call()).status).toBe(404);
  expect((await call("bad")).status).toBe(404);
  expect(readDirectory).toHaveBeenCalledTimes(1);
});
it("uses the verified identity and only serializes the authorized DTO", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "verified",
    email: "a@example.test",
    name: "A",
  });
  vi.mocked(readDirectory).mockResolvedValue({ residents: [] });
  const response = await call();
  expect(readDirectory).toHaveBeenCalledWith({}, "verified", id);
  expect(await response.json()).toEqual({ residents: [] });
  expect(response.headers.get("vary")).toBe("Cookie");
});
