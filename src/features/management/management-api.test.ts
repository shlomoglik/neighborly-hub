import { afterEach, expect, it, vi } from "vitest";
import { managementApi, ManagementRequestError } from "./management-api";
afterEach(() => vi.unstubAllGlobals());
it("uses same-origin credentials, no-store, safe IDs, bounded paging and cancellation", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({ projects: [] }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await managementApi.projects(2, signal);
  expect(fetch).toHaveBeenCalledWith("/api/management/projects?page=2", {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  await managementApi.hierarchy("unsafe/id?", signal);
  expect(fetch.mock.calls[1][0]).toBe("/api/management/projects/unsafe%2Fid%3F");
});
it.each([401, 404, 500])("propagates HTTP %i without synthetic fallback", async (status) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
  await expect(managementApi.projects(1, new AbortController().signal)).rejects.toEqual(
    new ManagementRequestError(status),
  );
});
