"use client";
import { useEffect, useRef, useState } from "react";
import { InvitationRequestError } from "./invitation-api";
export type ResourceStatus = "loading" | "ready" | "expired" | "unavailable" | "error";
/** No cache: discard the old snapshot before fetching, abort stale work and revalidate visible tabs. */
export function useInvitationResource<T>(key: string, loader: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [snapshot, setSnapshot] = useState<{ key: string; status: ResourceStatus; data: T | null }>(
    { key: "", status: "loading", data: null },
  );
  const load = useRef(loader);
  load.current = loader;
  const active = useRef<AbortController | null>(null);
  const requestKey = JSON.stringify([key, revision, paused]);
  const latest = useRef(requestKey);
  latest.current = requestKey;
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
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
    active.current = controller;
    setSnapshot({ key: requestKey, status: "loading", data: null });
    if (!paused && document.visibilityState !== "hidden")
      void load
        .current(controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setSnapshot({ key: requestKey, status: "ready", data });
        })
        .catch((cause) => {
          if (controller.signal.aborted) return;
          const code =
            cause instanceof InvitationRequestError
              ? cause.status
              : typeof cause === "object" &&
                  cause !== null &&
                  "status" in cause &&
                  typeof cause.status === "number"
                ? cause.status
                : 0;
          setSnapshot({
            key: requestKey,
            status: code === 401 ? "expired" : [403, 404].includes(code) ? "unavailable" : "error",
            data: null,
          });
        });
    return () => controller.abort();
  }, [requestKey, paused]);
  return {
    ...(snapshot.key === requestKey
      ? snapshot
      : { key: requestKey, status: "loading" as const, data: null }),
    refresh: () => setRevision((n) => n + 1),
    invalidate: (code: number) => {
      active.current?.abort();
      setSnapshot({
        key: latest.current,
        status: code === 401 ? "expired" : "unavailable",
        data: null,
      });
    },
  };
}
