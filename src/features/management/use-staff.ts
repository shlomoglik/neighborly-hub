"use client";
import { useEffect, useRef, useState } from "react";
import type { TKey } from "@/lib/i18n/dictionary";
import type { StaffInput, StaffPage } from "@/lib/access/staff-contracts";
import { staffApi, StaffRequestError, type StaffApi } from "./staff-api";
export type StaffStatus = "loading" | "ready" | "forbidden" | "unavailable" | "expired" | "error";
type Snapshot = { key: string; status: StaffStatus; data: StaffPage | null };
export function useStaff(projectId: string, api: StaffApi = staffApi) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ projectId: string; key: TKey; error: boolean } | null>(
    null,
  );
  const mutation = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ key: "", status: "loading", data: null });
  const key = JSON.stringify([projectId, page, revision, paused]);
  const latestKey = useRef(key);
  latestKey.current = key;
  const activeRead = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      mutation.current?.abort();
      mutation.current = null;
    },
    [projectId, api],
  );
  useEffect(() => {
    setBusy(false);
  }, [projectId]);
  useEffect(() => {
    const refresh = () => {
      if (!mutation.current) setRevision((n) => n + 1);
    };
    const visibility = () => {
      setPaused(document.visibilityState === "hidden");
      refresh();
    };
    const hide = () => {
      setPaused(true);
      refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refresh();
    }, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", visibility);
    document.addEventListener("visibilitychange", visibility);
    setPaused(document.visibilityState === "hidden");
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    activeRead.current = controller;
    setSnapshot({ key, status: "loading", data: null });
    if (!paused && document.visibilityState !== "hidden")
      void api
        .list(projectId, page, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setSnapshot({ key, status: "ready", data });
        })
        .catch((cause) => {
          if (controller.signal.aborted) return;
          const status = cause instanceof StaffRequestError ? cause.status : 0;
          setSnapshot({
            key,
            status:
              status === 401
                ? "expired"
                : status === 403
                  ? "forbidden"
                  : status === 404
                    ? "unavailable"
                    : "error",
            data: null,
          });
        });
    return () => controller.abort();
  }, [api, projectId, page, key, paused]);
  const view: Snapshot = snapshot.key === key ? snapshot : { key, status: "loading", data: null };
  async function write(action: (signal: AbortSignal) => Promise<unknown>, success: TKey) {
    if (mutation.current || view.status !== "ready") return false;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true);
    setNotice(null);
    try {
      await action(controller.signal);
      if (controller.signal.aborted) return false;
      setNotice({ projectId, key: success, error: false });
      setRevision((n) => n + 1);
      return true;
    } catch (cause) {
      if (controller.signal.aborted) return false;
      const status = cause instanceof StaffRequestError ? cause.status : 0;
      const code = cause instanceof StaffRequestError ? cause.code : "";
      if ([401, 403, 404].includes(status)) {
        activeRead.current?.abort();
        setSnapshot({
          key: latestKey.current,
          status: status === 401 ? "expired" : status === 403 ? "forbidden" : "unavailable",
          data: null,
        });
      }
      setNotice({
        projectId,
        error: true,
        key:
          code === "ALREADY_ASSIGNED"
            ? "staffDuplicate"
            : code === "USER_UNAVAILABLE"
              ? "staffUserUnavailable"
              : status === 400
                ? "staffInvalid"
                : [401, 403, 404].includes(status)
                  ? "staffAccessChanged"
                  : "staffUncertain",
      });
      return false;
    } finally {
      if (mutation.current === controller) {
        mutation.current = null;
        setBusy(false);
      }
    }
  }
  return {
    ...view,
    busy,
    notice: notice?.projectId === projectId ? notice : null,
    onRefresh: () => {
      if (!mutation.current) setRevision((n) => n + 1);
    },
    onPageChange: (value: number) => {
      if (!mutation.current) setPage(value);
    },
    onAdd: (input: StaffInput) =>
      write((signal) => api.add(projectId, input, signal), "staffAdded"),
    onRemove: (id: string) => write((signal) => api.remove(projectId, id, signal), "staffRemoved"),
  };
}
