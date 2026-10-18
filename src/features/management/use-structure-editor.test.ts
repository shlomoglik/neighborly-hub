// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useStructureEditor } from "./use-structure-editor";
import { StructureRequestError } from "./structure-api";
afterEach(cleanup);
it("saves once, closes only on confirmed success and reloads persisted state", async () => {
  let finish!: (value: { id: string }) => void;
  const save = vi.fn<NonNullable<Parameters<typeof useStructureEditor>[3]>>(
    () =>
      new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const refresh = vi.fn();
  const lost = vi.fn();
  const { result } = renderHook(() => useStructureEditor("p", refresh, lost, save));
  act(() => result.current.onOpen({ mode: "create", entity: "building" }));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.onSave("A");
    void result.current.onSave("B");
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
  act(() => result.current.onClose());
  expect(result.current.target).not.toBeNull();
  await act(async () => {
    finish({ id: "new" });
    await pending;
  });
  expect(result.current.target).toBeNull();
  expect(refresh).toHaveBeenCalledOnce();
  expect(lost).not.toHaveBeenCalled();
});
it.each([
  [409, "DUPLICATE_STRUCTURE", "structureDuplicate"],
  [409, "STALE_STRUCTURE", "structureStale"],
  [500, "FAILED", "structureUncertain"],
] as const)("retains the form after HTTP %i (%s)", async (status, code, key) => {
  const save = vi.fn().mockRejectedValue(new StructureRequestError(status, code));
  const refresh = vi.fn();
  const { result } = renderHook(() => useStructureEditor("p", refresh, vi.fn(), save));
  act(() => result.current.onOpen({ mode: "create", entity: "building" }));
  await act(async () => {
    await result.current.onSave("Draft");
  });
  expect(result.current.error).toBe(key);
  expect(result.current.target).not.toBeNull();
  expect(refresh).not.toHaveBeenCalled();
});
it.each([401, 403, 404])(
  "clears the editor and invalidates the read workspace after HTTP %i",
  async (status) => {
    const save = vi.fn().mockRejectedValue(new StructureRequestError(status, "DENIED"));
    const lost = vi.fn();
    const { result } = renderHook(() => useStructureEditor("p", vi.fn(), lost, save));
    act(() => result.current.onOpen({ mode: "create", entity: "building" }));
    await act(async () => {
      await result.current.onSave("Draft");
    });
    expect(result.current.target).toBeNull();
    expect(lost).toHaveBeenCalledWith(status);
  },
);
it("aborts obsolete writes and ignores late completion after navigation", async () => {
  let finish!: (value: { id: string }) => void;
  const save = vi.fn<NonNullable<Parameters<typeof useStructureEditor>[3]>>(
    () =>
      new Promise<{ id: string }>((resolve) => {
        finish = resolve;
      }),
  );
  const refresh = vi.fn();
  const lost = vi.fn();
  const { result, rerender } = renderHook(({ id }) => useStructureEditor(id, refresh, lost, save), {
    initialProps: { id: "p" },
  });
  act(() => result.current.onOpen({ mode: "create", entity: "building" }));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.onSave("A");
  });
  const signal = save.mock.calls[0][3];
  rerender({ id: "q" });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish({ id: "old" });
    await pending;
  });
  expect(result.current.target).toBeNull();
  expect(refresh).not.toHaveBeenCalled();
  expect(lost).not.toHaveBeenCalled();
});
