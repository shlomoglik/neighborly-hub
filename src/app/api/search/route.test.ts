import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/access/directory", () => ({ readGlobalSearch: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));
import { getCurrentUser } from "@/lib/auth/session";
import { readGlobalSearch } from "@/lib/access/directory";
import { GET } from "./route";
beforeEach(() => vi.resetAllMocks());
it("requires authentication before validating or searching", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  const result = await GET(
    new Request("https://example.test/api/search?query=someone&userId=forged"),
  );
  expect(result.status).toBe(401);
  expect(readGlobalSearch).not.toHaveBeenCalled();
});
it.each(["", "?query=a", "?query=xx&page=0", "?query=xx&page=10001", `?query=${"a".repeat(101)}`])(
  "rejects invalid queries: %s",
  async (query) => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "current",
      name: "A",
      email: "a@example.test",
    });
    expect((await GET(new Request(`https://example.test/api/search${query}`))).status).toBe(400);
    expect(readGlobalSearch).not.toHaveBeenCalled();
  },
);
it("takes identity only from the session and prevents response caching", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: "current",
    name: "A",
    email: "a@example.test",
  });
  vi.mocked(readGlobalSearch).mockResolvedValue({ residents: [], page: 2, hasNext: false });
  const result = await GET(
    new Request(
      "https://example.test/api/search?query=%20Name%20&page=2&userId=forged&projectId=forged",
    ),
  );
  expect(readGlobalSearch).toHaveBeenCalledWith({}, "current", { query: "Name", page: 2 });
  expect(await result.json()).toEqual({ residents: [], page: 2, hasNext: false });
  expect(result.headers.get("cache-control")).toBe("private, no-store");
  expect(result.headers.get("vary")).toBe("Cookie");
});
