import { afterEach, expect, it, vi } from "vitest";
import { householdApi } from "./household-api";
import { PrivateRequestError } from "@/features/shared/private-api";
afterEach(() => vi.unstubAllGlobals());
it("uses private same-origin reads and typed writes without accepting caller identity", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ id: "home" }));
  vi.stubGlobal("fetch", fetcher);
  const signal = new AbortController().signal;
  await householdApi.detail("home/id", 2, signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/households/home%2Fid?page=2",
    expect.objectContaining({
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      signal,
    }),
  );
  const body = { action: "rename" as const, name: "New", expected: "Old" };
  await householdApi.update("home", body, signal);
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/households/home",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify(body),
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
    }),
  );
});
it("preserves authorization and conflict status for client invalidation", async () => {
  for (const code of [401, 403, 404, 409]) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: "STALE_HOUSEHOLD" }, { status: code })),
    );
    await expect(householdApi.mine(1, new AbortController().signal)).rejects.toEqual(
      new PrivateRequestError(code, "STALE_HOUSEHOLD"),
    );
  }
});
