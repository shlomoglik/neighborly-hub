import { afterEach, expect, it, vi } from "vitest";
import { staffApi, StaffRequestError } from "./staff-api";
afterEach(() => vi.unstubAllGlobals());
it("uses private same-origin requests with encoded paths and explicit write bodies", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({}));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await staffApi.list("a/b", 2, signal);
  expect(fetch.mock.calls[0][0]).toBe("/api/management/projects/a%2Fb/staff?page=2");
  await staffApi.add(
    "p",
    { email: "USER@example.test", role: "project_manager", buildingId: null },
    signal,
  );
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal,
    body: JSON.stringify({ email: "user@example.test", role: "project_manager", buildingId: null }),
  });
  await staffApi.remove("p", "unsafe/id", signal);
  expect(fetch.mock.calls[2][0]).toBe("/api/management/projects/p/staff/unsafe%2Fid");
  expect(fetch.mock.calls[2][1].method).toBe("DELETE");
});
it("propagates structured and non-JSON failures without synthetic results", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: "ALREADY_ASSIGNED" }, { status: 409 })),
  );
  await expect(staffApi.list("p", 1, new AbortController().signal)).rejects.toEqual(
    new StaffRequestError(409, "ALREADY_ASSIGNED"),
  );
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
  await expect(staffApi.list("p", 1, new AbortController().signal)).rejects.toEqual(
    new StaffRequestError(500, "INTERNAL_ERROR"),
  );
});
