// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInvitationResource } from "./use-invitation-resource";
import { useInvitationAction } from "./use-invitation-action";
import { InvitationRequestError } from "./invitation-api";
beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
it("clears old scope immediately, aborts requests and ignores late responses", async () => {
  let finish!: (value: string) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          finish = r;
        }),
    )
    .mockResolvedValue("new scope");
  const { result, rerender } = renderHook(({ scope }) => useInvitationResource(scope, load), {
    initialProps: { scope: "old" },
  });
  await tick();
  const signal = load.mock.calls[0][0] as AbortSignal;
  rerender({ scope: "new" });
  expect(result.current.data).toBeNull();
  expect(signal.aborted).toBe(true);
  await tick();
  await act(async () => finish("private old scope"));
  expect(result.current.data).toBe("new scope");
});
it.each([
  [401, "expired"],
  [403, "unavailable"],
  [404, "unavailable"],
  [500, "error"],
] as const)("clears live data on %i and permits explicit retry", async (code, status) => {
  const load = vi.fn().mockResolvedValue("private data");
  const { result } = renderHook(() => useInvitationResource("project", load));
  await tick();
  expect(result.current.data).toBe("private data");
  load.mockRejectedValueOnce(new InvitationRequestError(code, "FAILED"));
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current.data).toBeNull();
  await tick();
  expect(result.current.status).toBe(status);
  act(() => result.current.refresh());
  await tick();
  expect(result.current.data).toBe("private data");
});
it("hides private data while backgrounded and revalidates on visibility and polling", async () => {
  const load = vi.fn().mockResolvedValue("private");
  const { result } = renderHook(() => useInvitationResource("scope", load));
  await tick();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.data).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(load).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await tick();
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(load).toHaveBeenCalledTimes(3);
});
it("prevents duplicate writes, aborts obsolete writes and never retries automatically", async () => {
  let finish!: (value: string) => void;
  const write = vi.fn(
    () =>
      new Promise<string>((r) => {
        finish = r;
      }),
  );
  const { result, rerender } = renderHook(({ scope }) => useInvitationAction(scope), {
    initialProps: { scope: "old" },
  });
  let pending!: Promise<unknown>;
  act(() => {
    pending = result.current.run(write);
    void result.current.run(write);
  });
  expect(write).toHaveBeenCalledTimes(1);
  rerender({ scope: "new" });
  await act(async () => {
    finish("late result");
    expect(await pending).toBeNull();
  });
  const denied = vi.fn();
  await act(async () => {
    await result.current.run(async () => {
      throw new InvitationRequestError(401, "UNAUTHENTICATED");
    }, denied);
  });
  expect(denied).toHaveBeenCalledWith(401);
  expect(result.current.error).toBe("UNAUTHENTICATED");
  await act(async () => {
    await result.current.run(async () => {
      throw new Error("offline");
    });
  });
  expect(result.current.error).toBe("UNCERTAIN");
  act(() => window.dispatchEvent(new Event("focus")));
  expect(write).toHaveBeenCalledTimes(1);
});
it("invalidation cancels a pending read so denial cannot be overwritten", async () => {
  let finish!: (value: string) => void;
  const { result } = renderHook(() =>
    useInvitationResource(
      "scope",
      () =>
        new Promise<string>((r) => {
          finish = r;
        }),
    ),
  );
  act(() => result.current.invalidate(404));
  await act(async () => finish("stale permission"));
  expect(result.current.status).toBe("unavailable");
  expect(result.current.data).toBeNull();
});
