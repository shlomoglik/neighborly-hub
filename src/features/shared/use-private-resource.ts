"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PrivateRequestError } from "./private-api";
export type ResourceStatus = "loading" | "ready" | "expired" | "unavailable" | "error";
/** Revalidate visible tabs; optional same-key retention never survives hiding or access loss. */
export function usePrivateResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  { keepDataOnRefresh = false }: { keepDataOnRefresh?: boolean } = {},
) {
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    source: string;
    status: ResourceStatus;
    data: T | null;
  }>({ key: "", source: key, status: "loading", data: null });
  const load = useRef(loader);
  load.current = loader;
  const active = useRef<AbortController | null>(null);
  const requestKey = JSON.stringify([key, revision, paused]);
  const latest = useRef({ requestKey, key });
  latest.current = { requestKey, key };
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    const hide = () => {
      active.current?.abort();
      setSnapshot((previous) => ({ ...previous, status: "loading", data: null }));
      setPaused(true);
      refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        hide();
        return;
      }
      setPaused(false);
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
    active.current = controller;
    setSnapshot((previous) => ({
      key: requestKey,
      source: key,
      status: "loading",
      data:
        keepDataOnRefresh &&
        !paused &&
        typeof document !== "undefined" &&
        document.visibilityState !== "hidden" &&
        previous.source === key
          ? previous.data
          : null,
    }));
    if (!paused && document.visibilityState !== "hidden")
      void load
        .current(controller.signal)
        .then((data) => {
          if (!controller.signal.aborted)
            setSnapshot({ key: requestKey, source: key, status: "ready", data });
        })
        .catch((cause) => {
          if (controller.signal.aborted) return;
          const code =
            cause instanceof PrivateRequestError
              ? cause.status
              : typeof cause === "object" &&
                  cause !== null &&
                  "status" in cause &&
                  typeof cause.status === "number"
                ? cause.status
                : 0;
          setSnapshot({
            key: requestKey,
            source: key,
            status: code === 401 ? "expired" : [403, 404].includes(code) ? "unavailable" : "error",
            data: null,
          });
        });
    return () => controller.abort();
  }, [requestKey, paused, key, keepDataOnRefresh]);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const invalidate = useCallback((code: number) => {
    active.current?.abort();
    setSnapshot({
      key: latest.current.requestKey,
      source: latest.current.key,
      status: code === 401 ? "expired" : "unavailable",
      data: null,
    });
  }, []);
  const view =
    snapshot.key === requestKey
      ? snapshot
      : {
          key: requestKey,
          status: "loading" as const,
          data:
            keepDataOnRefresh &&
            !paused &&
            typeof document !== "undefined" &&
            document.visibilityState !== "hidden" &&
            snapshot.source === key
              ? snapshot.data
              : null,
        };
  const refreshing = view.status === "loading" && view.data !== null;
  return {
    key: view.key,
    status: refreshing ? ("ready" as const) : view.status,
    data: view.data,
    refreshing,
    refresh,
    invalidate,
  };
}
