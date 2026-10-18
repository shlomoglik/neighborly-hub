"use client";
import { useEffect, useRef, useState } from "react";
import { PrivateRequestError } from "./private-api";
/** Writes never retry automatically; abort does not undo a committed transaction. */
export function usePrivateAction(scope: string) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ scope: string; code: string } | null>(null);
  useEffect(() => {
    setBusy(false);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [scope]);
  return {
    busy,
    error: failure?.scope === scope ? failure.code : null,
    clear: () => setFailure(null),
    run: async <T>(
      action: (signal: AbortSignal) => Promise<T>,
      onDenied?: (code: number) => void,
    ): Promise<{ value: T } | null> => {
      if (pending.current) return null;
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setFailure(null);
      try {
        const value = await action(controller.signal);
        return controller.signal.aborted ? null : { value };
      } catch (cause) {
        if (!controller.signal.aborted) {
          const code = cause instanceof PrivateRequestError ? cause.code : "UNCERTAIN";
          setFailure({ scope, code });
          if (cause instanceof PrivateRequestError && [401, 403, 404].includes(cause.status))
            onDenied?.(cause.status);
        }
        return null;
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy(false);
        }
      }
    },
  };
}
