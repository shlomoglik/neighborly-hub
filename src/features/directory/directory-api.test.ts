import { afterEach, expect, it, vi } from "vitest";
import { directoryApi, DirectoryRequestError } from "./directory-api";
afterEach(() => vi.unstubAllGlobals());
it("uses uncached same-origin reads and encodes literal search text", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ residents: [], page: 2, hasNext: false }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await directoryApi.residents(
    "project",
    { query: "אורי & %", buildingId: "building", page: 2 },
    signal,
  );
  const [url, options] = fetch.mock.calls[0];
  const parsed = new URL(url, "https://example.test");
  expect(parsed.searchParams.get("query")).toBe("אורי & %");
  expect(parsed.searchParams.get("page")).toBe("2");
  expect(options).toMatchObject({ credentials: "same-origin", cache: "no-store", signal });
});
it("reduces server error bodies to a status without exposing private messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: "private provider detail" }, { status: 401 })),
  );
  await expect(directoryApi.projects(new AbortController().signal)).rejects.toEqual(
    new DirectoryRequestError(401),
  );
});
