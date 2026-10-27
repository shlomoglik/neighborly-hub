// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PrivateRequestError } from "./private-api";
import { usePrivateResource } from "./use-private-resource";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it.each([false, true])(
  "same-key refresh retains data only when opted in (%s)",
  async (keepDataOnRefresh) => {
    const next = deferred<string>();
    const loader = vi.fn().mockResolvedValueOnce("Household").mockReturnValue(next.promise);
    const { result } = renderHook(() => usePrivateResource("one", loader, { keepDataOnRefresh }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.refresh());
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBe(keepDataOnRefresh ? "Household" : null);
    await act(async () => next.resolve("Updated household"));
    expect(result.current.data).toBe("Updated household");
  },
);
it("clears retained data immediately when the household changes and ignores stale responses", async () => {
  const old = deferred<string>();
  const next = deferred<string>();
  const loader = vi
    .fn()
    .mockResolvedValueOnce("Household one")
    .mockReturnValueOnce(old.promise)
    .mockReturnValue(next.promise);
  const { result, rerender } = renderHook(
    ({ id }) => usePrivateResource(id, loader, { keepDataOnRefresh: true }),
    { initialProps: { id: "one" } },
  );
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => result.current.refresh());
  rerender({ id: "two" });
  expect(result.current.data).toBeNull();
  await act(async () => old.resolve("Stale household one"));
  expect(result.current.data).toBeNull();
  await act(async () => next.resolve("Household two"));
  expect(result.current.data).toBe("Household two");
});
it.each([401, 403, 404])("clears retained data after HTTP %s", async (status) => {
  const next = deferred<string>();
  const loader = vi.fn().mockResolvedValueOnce("Private household").mockReturnValue(next.promise);
  const { result } = renderHook(() =>
    usePrivateResource("one", loader, { keepDataOnRefresh: true }),
  );
  await waitFor(() => expect(result.current.status).toBe("ready"));
  act(() => result.current.refresh());
  await act(async () => next.reject(new PrivateRequestError(status, "ACCESS_DENIED")));
  expect(result.current.data).toBeNull();
  expect(result.current.status).toBe(status === 401 ? "expired" : "unavailable");
});
it("clears retained data when the page is hidden and does not restore it until a fresh read", async () => {
  const next = deferred<string>();
  const loader = vi.fn().mockResolvedValueOnce("Private household").mockReturnValue(next.promise);
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const { result } = renderHook(() =>
    usePrivateResource("one", loader, { keepDataOnRefresh: true }),
  );
  await waitFor(() => expect(result.current.status).toBe("ready"));
  visibility.mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.data).toBeNull();
  visibility.mockReturnValue("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.data).toBeNull();
  await act(async () => next.resolve("Fresh household"));
  expect(result.current.data).toBe("Fresh household");
  act(() => result.current.invalidate(403));
  expect(result.current.data).toBeNull();
});
