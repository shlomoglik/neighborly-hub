// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStaff } from "./use-staff";
import { StaffRequestError, type StaffApi } from "./staff-api";
import type { StaffPage } from "@/lib/access/staff-contracts";
const data: StaffPage = {
  project: { id: "p", name: "Saved project" },
  buildings: [],
  assignments: [
    {
      id: "a",
      name: "Private admin data",
      email: "private@example.test",
      role: "project_manager",
      buildingId: null,
    },
  ],
  page: 1,
  hasNext: false,
};
const input = { email: "target@example.test", role: "project_manager" as const, buildingId: null };
function service(): StaffApi {
  return {
    list: vi.fn().mockResolvedValue(data),
    add: vi.fn().mockResolvedValue({ assignmentId: "new" }),
    remove: vi.fn().mockResolvedValue({ removed: true }),
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
it("ignores late list responses, immediately clears old project data and aborts obsolete work", async () => {
  const api = service();
  let finish!: (value: StaffPage) => void;
  vi.mocked(api.list).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ id }) => useStaff(id, api), {
    initialProps: { id: "p" },
  });
  await tick();
  const signal = vi.mocked(api.list).mock.calls[0][2];
  vi.mocked(api.list).mockResolvedValue({
    ...data,
    project: { id: "q", name: "New project" },
    assignments: [],
  });
  rerender({ id: "q" });
  expect(result.current.data).toBeNull();
  expect(signal.aborted).toBe(true);
  await tick();
  await act(async () => finish(data));
  expect(result.current.data?.project.id).toBe("q");
  expect(result.current.data?.assignments).toEqual([]);
});
it.each([
  [401, "expired"],
  [403, "forbidden"],
  [404, "unavailable"],
  [500, "error"],
] as const)("clears staff data on HTTP %i", async (status, state) => {
  const api = service();
  const { result } = renderHook(() => useStaff("p", api));
  await tick();
  vi.mocked(api.list).mockRejectedValue(new StaffRequestError(status, "FAILED"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current.data).toBeNull();
  await tick();
  expect(result.current.status).toBe(state);
  expect(result.current.data).toBeNull();
  vi.mocked(api.list).mockResolvedValue(data);
  act(() => result.current.onRefresh());
  await tick();
  expect(result.current.status).toBe("ready");
});
it("prevents duplicate submissions and revalidates after successful writes without optimistic grants", async () => {
  const api = service();
  let finish!: (value: { assignmentId: string }) => void;
  vi.mocked(api.add).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useStaff("p", api));
  await tick();
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.onAdd(input);
    void result.current.onAdd(input);
  });
  expect(api.add).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(api.list).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({ assignmentId: "new" });
    await pending;
  });
  await tick();
  expect(result.current.notice?.key).toBe("staffAdded");
  expect(result.current.busy).toBe(false);
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(result.current.data?.assignments).toEqual(data.assignments);
  await act(async () => {
    await result.current.onRemove("a");
  });
  await tick();
  expect(api.remove).toHaveBeenCalledWith("p", "a", expect.any(AbortSignal));
  expect(result.current.notice?.key).toBe("staffRemoved");
});
it.each([
  [409, "ALREADY_ASSIGNED", "staffDuplicate"],
  [400, "USER_UNAVAILABLE", "staffUserUnavailable"],
  [500, "INTERNAL_ERROR", "staffUncertain"],
] as const)(
  "explains rejected/uncertain writes (%i) without inventing success",
  async (status, code, key) => {
    const api = service();
    vi.mocked(api.add).mockRejectedValue(new StaffRequestError(status, code));
    const { result } = renderHook(() => useStaff("p", api));
    await tick();
    await act(async () => {
      expect(await result.current.onAdd(input)).toBe(false);
    });
    expect(result.current.notice).toMatchObject({ key, error: true });
    expect(result.current.busy).toBe(false);
  },
);
it("discards a late mutation response after project navigation and never refreshes the wrong project", async () => {
  const api = service();
  let finish!: (value: { assignmentId: string }) => void;
  vi.mocked(api.add).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ id }) => useStaff(id, api), {
    initialProps: { id: "p" },
  });
  await tick();
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.onAdd(input);
  });
  const signal = vi.mocked(api.add).mock.calls[0][2];
  rerender({ id: "q" });
  expect(signal.aborted).toBe(true);
  expect(result.current.data).toBeNull();
  await tick();
  await act(async () => {
    finish({ assignmentId: "new" });
    expect(await pending).toBe(false);
  });
  expect(result.current.notice).toBeNull();
  expect(result.current.busy).toBe(false);
});
it("revalidates visible tabs and removes staff data on hidden/cached pages", async () => {
  const api = service();
  const { result, unmount } = renderHook(() => useStaff("p", api));
  await tick();
  await tick(30000);
  expect(api.list).toHaveBeenCalledTimes(2);
  act(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(result.current.data).toBeNull();
  await tick(31000);
  expect(api.list).toHaveBeenCalledTimes(2);
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
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([401, 403, 404])(
  "removes staff records immediately if a mutation loses access (%i)",
  async (status) => {
    const api = service();
    const { result } = renderHook(() => useStaff("p", api));
    await tick();
    vi.mocked(api.remove).mockRejectedValue(new StaffRequestError(status, "FORBIDDEN"));
    await act(async () => {
      expect(await result.current.onRemove("a")).toBe(false);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe(
      status === 401 ? "expired" : status === 403 ? "forbidden" : "unavailable",
    );
  },
);

it("does not let a concurrent read restore staff records after a denied mutation", async () => {
  const api = service();
  let deny!: (cause: unknown) => void;
  let finishRead!: (value: StaffPage) => void;
  vi.mocked(api.remove).mockImplementation(
    () =>
      new Promise((_, reject) => {
        deny = reject;
      }),
  );
  const { result } = renderHook(() => useStaff("p", api));
  await tick();
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.onRemove("a");
  });
  act(() => window.dispatchEvent(new Event("pagehide")));
  vi.mocked(api.list).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  act(() => window.dispatchEvent(new Event("pageshow")));
  await tick();
  await act(async () => {
    deny(new StaffRequestError(403, "FORBIDDEN"));
    await pending;
  });
  await act(async () => finishRead(data));
  expect(result.current.status).toBe("forbidden");
  expect(result.current.data).toBeNull();
});
