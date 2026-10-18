// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useManagement } from "./use-management";
import { ManagementRequestError, type ManagementApi } from "./management-api";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
const project = { id: "p", name: "Saved project", city: "City" };
const data: ManagementHierarchy = {
  ...project,
  buildings: [{ id: "b", name: "Building", floors: [] }],
  canAddBuilding: false,
  counts: { buildings: 1, floors: 0, apartments: 0 },
};
const discovery = {
  projects: [project],
  page: 1,
  hasNext: false,
  hasManagementAccess: true,
  canCreateProject: false,
};
function service(): ManagementApi {
  return {
    projects: vi.fn().mockResolvedValue(discovery),
    hierarchy: vi.fn().mockResolvedValue(data),
  };
}
async function tick(ms = 0) {
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
it("supports direct links outside the discovery page, project changes and building changes without stale content", async () => {
  const api = service();
  vi.mocked(api.projects).mockResolvedValue({ ...discovery, projects: [] });
  const { result, rerender } = renderHook(({ id }) => useManagement(id, api), {
    initialProps: { id: "p" },
  });
  await tick();
  expect(result.current.status).toBe("ready");
  act(() => result.current.onBuildingChange("b"));
  expect(result.current.data).toBeNull();
  await tick();
  rerender({ id: "other" });
  expect(result.current.data).toBeNull();
  expect(result.current.discovery).toBeNull();
  expect(result.current.buildingId).toBe("");
  await tick();
  expect(api.hierarchy).toHaveBeenLastCalledWith("other", expect.any(AbortSignal));
});
it("ignores late responses even when transport ignores cancellation", async () => {
  const api = service();
  let finish!: (value: ManagementHierarchy) => void;
  vi.mocked(api.hierarchy).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ id }) => useManagement(id, api), {
    initialProps: { id: "p" },
  });
  await tick();
  const signal = vi.mocked(api.hierarchy).mock.calls.at(-1)![1];
  const oldFinish = finish;
  vi.mocked(api.hierarchy).mockResolvedValue({ ...data, id: "new" });
  rerender({ id: "new" });
  expect(signal.aborted).toBe(true);
  await tick();
  await act(async () => oldFinish(data));
  expect(result.current.data?.id).toBe("new");
});
it.each([401, 403, 404, 500, 0])(
  "clears hierarchy on refresh and handles %i with explicit states",
  async (code) => {
    const api = service();
    const { result } = renderHook(() => useManagement("p", api));
    await tick();
    vi.mocked(api.hierarchy).mockRejectedValue(new ManagementRequestError(code));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.data).toBeNull();
    await tick();
    expect(result.current.status).toBe(
      code === 401 ? "expired" : code === 403 || code === 404 ? "unavailable" : "error",
    );
    expect(result.current.data).toBeNull();
    vi.mocked(api.hierarchy).mockResolvedValue(data);
    act(() => result.current.onRefresh());
    await tick();
    expect(result.current.status).toBe("ready");
  },
);
it("does not silently switch a revoked project or building to another", async () => {
  const api = service();
  const { result } = renderHook(() => useManagement("p", api));
  await tick();
  act(() => result.current.onBuildingChange("b"));
  await tick();
  vi.mocked(api.hierarchy).mockResolvedValue({ ...data, buildings: [] });
  act(() => result.current.onRefresh());
  expect(result.current.data).toBeNull();
  await tick();
  expect(result.current.status).toBe("unavailable");
  expect(result.current.buildingId).toBe("b");
  vi.mocked(api.hierarchy).mockRejectedValue(new ManagementRequestError(404));
  act(() => result.current.onRefresh());
  await tick();
  expect(result.current.status).toBe("unavailable");
  expect(result.current.selectedProjectId).toBe("p");
});
it("distinguishes empty discovery from no management grants without issuing a detail request", async () => {
  const api = service();
  vi.mocked(api.projects).mockResolvedValue({ ...discovery, projects: [], canCreateProject: true });
  const { result } = renderHook(() => useManagement("", api));
  await tick();
  expect(result.current.status).toBe("empty");
  expect(api.hierarchy).not.toHaveBeenCalled();
  vi.mocked(api.projects).mockResolvedValue({
    ...discovery,
    projects: [],
    hasManagementAccess: false,
  });
  act(() => result.current.onRefresh());
  await tick();
  expect(result.current.status).toBe("forbidden");
});
it("clears hidden and cached pages, revalidates on visibility without polling, and cleans up", async () => {
  const api = service();
  const { result, unmount } = renderHook(() => useManagement("p", api));
  await tick();
  act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.data).toBeNull();
  const calls = vi.mocked(api.projects).mock.calls.length;
  await tick(31000);
  expect(api.projects).toHaveBeenCalledTimes(calls);
  act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await tick();
  expect(result.current.status).toBe("ready");
  await tick(30000);
  expect(api.projects).toHaveBeenCalledTimes(calls + 1);
  act(() => window.dispatchEvent(new Event("pagehide")));
  expect(result.current.data).toBeNull();
  act(() => window.dispatchEvent(new Event("pageshow")));
  await tick();
  expect(result.current.status).toBe("ready");
  const signal = vi.mocked(api.hierarchy).mock.calls.at(-1)![1];
  unmount();
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("cannot restore old hierarchy after a mutation invalidates access during a concurrent read", async () => {
  const adapter = service();
  const { result } = renderHook(() => useManagement("p", adapter));
  await tick();
  let finish!: (value: ManagementHierarchy) => void;
  vi.mocked(adapter.hierarchy).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => result.current.onRefresh());
  await tick();
  const signal = vi.mocked(adapter.hierarchy).mock.calls.at(-1)![1];
  act(() => result.current.onAccessLost(404));
  expect(signal.aborted).toBe(true);
  await act(async () => finish(data));
  expect(result.current.status).toBe("unavailable");
  expect(result.current.data).toBeNull();
});

it("keeps the visible workspace stable until an explicit refresh or lifecycle event", async () => {
  const api = service();
  const { result } = renderHook(() => useManagement("p", api));
  await tick();
  const calls = vi.mocked(api.projects).mock.calls.length;
  await tick(120000);
  expect(api.projects).toHaveBeenCalledTimes(calls);
  expect(result.current.status).toBe("ready");
  expect(result.current.data).toEqual(data);
  act(() => result.current.onRefresh());
  expect(result.current.status).toBe("loading");
  await tick();
  expect(api.projects).toHaveBeenCalledTimes(calls + 1);
  expect(result.current.status).toBe("ready");
});
