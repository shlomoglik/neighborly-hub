// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDirectory } from "./use-directory";
import { DirectoryRequestError, type DirectoryApi } from "./directory-api";
import type { DirectoryPage } from "@/lib/access/contracts";
const projects = [{ id: "p", name: "Project", buildings: [{ id: "b", name: "Building" }] }];
const privatePage: DirectoryPage = {
  page: 1,
  hasNext: false,
  residents: [
    {
      personId: "person",
      name: "Private resident",
      householdId: "home",
      householdName: "Family",
      buildingId: "b",
      buildingName: "Building",
      apartment: "1",
      contacts: [{ kind: "phone", value: "0501234567", label: null }],
    },
  ],
};
function api(): DirectoryApi {
  return {
    projects: vi.fn().mockResolvedValue(projects),
    residents: vi.fn().mockResolvedValue(privatePage),
  };
}
async function tick(ms = 250) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("discovers permitted projects before fetching residents with the selected filters", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  expect(result.current.status).toBe("loading");
  await tick();
  expect(result.current.status).toBe("ready");
  expect(result.current.selectedProjectId).toBe("p");
  expect(service.residents).toHaveBeenCalledWith(
    "p",
    { query: "", buildingId: "", page: 1 },
    expect.any(AbortSignal),
  );
  act(() => result.current.onPageChange(3));
  expect(result.current.data).toBeNull();
  await tick();
  act(() => result.current.onQueryChange("Noa"));
  expect(result.current.query.page).toBe(1);
  await tick();
  expect(service.residents).toHaveBeenLastCalledWith(
    "p",
    { query: "Noa", buildingId: "", page: 1 },
    expect.any(AbortSignal),
  );
  act(() => result.current.onBuildingChange("b"));
  await tick();
  act(() => result.current.onProjectChange("p"));
  expect(result.current.query).toEqual({ query: "", buildingId: "", page: 1 });
});
it.each([401, 403, 404, 500])(
  "clears private values immediately on revalidation and after HTTP %i",
  async (status) => {
    const service = api();
    const { result } = renderHook(() => useDirectory(service));
    await tick();
    expect(result.current.data?.residents[0].contacts[0].value).toBe("0501234567");
    vi.mocked(service.residents).mockRejectedValue(new DirectoryRequestError(status));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("loading");
    await tick();
    expect(result.current.status).toBe(
      status === 401 ? "expired" : status === 500 ? "error" : "forbidden",
    );
    expect(result.current.data).toBeNull();
    expect(result.current.projects).toEqual([]);
  },
);
it("ignores a late response for an old filter even if a transport ignores abort", async () => {
  const service = api();
  let finish!: (page: DirectoryPage) => void;
  vi.mocked(service.residents).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  const firstSignal = vi.mocked(service.residents).mock.calls[0][2];
  act(() => result.current.onQueryChange("new"));
  expect(firstSignal.aborted).toBe(true);
  vi.mocked(service.residents).mockResolvedValue({ page: 1, hasNext: false, residents: [] });
  await tick();
  await act(async () => finish(privatePage));
  expect(result.current.data?.residents).toEqual([]);
});
it("polls visible tabs and removes all data after a link is revoked", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  vi.mocked(service.projects).mockResolvedValue([]);
  await tick(30000);
  expect(result.current.data).toBeNull();
  await tick();
  expect(result.current.status).toBe("unlinked");
  expect(result.current.projects).toEqual([]);
});
it("clears hidden and cached-page snapshots and revalidates on return", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.data).toBeNull();
  const count = vi.mocked(service.projects).mock.calls.length;
  await tick(31000);
  expect(service.projects).toHaveBeenCalledTimes(count);
  act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick();
  expect(result.current.status).toBe("ready");
  act(() => window.dispatchEvent(new Event("pagehide")));
  expect(result.current.data).toBeNull();
  act(() => window.dispatchEvent(new Event("pageshow")));
  await tick();
  expect(result.current.status).toBe("ready");
});
it("does not fetch a project removed from the discovery response", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  act(() => result.current.onProjectChange("missing"));
  await tick();
  expect(result.current.status).toBe("forbidden");
  expect(result.current.data).toBeNull();
  expect(service.residents).toHaveBeenCalledTimes(1);
});
it("aborts pending work and removes periodic refresh on unmount", async () => {
  const service = api();
  const { unmount } = renderHook(() => useDirectory(service));
  await tick();
  const signal = vi.mocked(service.residents).mock.calls[0][2];
  unmount();
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps the initial project pinned when discovery ordering changes", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  vi.mocked(service.projects).mockResolvedValue([
    { id: "new", name: "Earlier project", buildings: [] },
    ...projects,
  ]);
  act(() => result.current.onRefresh());
  await tick();
  expect(service.residents).toHaveBeenLastCalledWith(
    "p",
    expect.any(Object),
    expect.any(AbortSignal),
  );
  expect(result.current.selectedProjectId).toBe("p");
});

it("resets a revoked building filter before issuing another resident query", async () => {
  const service = api();
  const { result } = renderHook(() => useDirectory(service));
  await tick();
  act(() => result.current.onBuildingChange("b"));
  await tick();
  vi.mocked(service.projects).mockResolvedValue([{ ...projects[0], buildings: [] }]);
  act(() => result.current.onRefresh());
  await tick();
  expect(result.current.data).toBeNull();
  expect(result.current.query.buildingId).toBe("");
  await tick();
  expect(service.residents).toHaveBeenLastCalledWith(
    "p",
    { query: "", buildingId: "", page: 1 },
    expect.any(AbortSignal),
  );
});
