"use client";
import { useEffect, useRef, useState } from "react";
import type { TKey } from "@/lib/i18n/dictionary";
import type { StructureEditTarget } from "@/lib/access/structure-management-contracts";
import { saveStructure, StructureRequestError } from "./structure-api";
export function useStructureEditor(
  projectId: string,
  onRefresh: () => void,
  onAccessLost: (status: number) => void,
  save = saveStructure,
) {
  const [target, setTarget] = useState<StructureEditTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    setTarget(null);
    setBusy(false);
    setError(null);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [projectId, save]);
  return {
    target,
    busy,
    error,
    onOpen: (value: StructureEditTarget) => {
      if (!pending.current) {
        setTarget(value);
        setError(null);
      }
    },
    onClose: () => {
      if (!pending.current) {
        setTarget(null);
        setError(null);
      }
    },
    onSave: async (value: string) => {
      if (!target || pending.current) return;
      const controller = new AbortController();
      pending.current = controller;
      setBusy(true);
      setError(null);
      try {
        await save(projectId, target, value, controller.signal);
        if (controller.signal.aborted) return;
        setTarget(null);
        onRefresh();
      } catch (cause) {
        if (controller.signal.aborted) return;
        const code = cause instanceof StructureRequestError ? cause.code : "";
        const status = cause instanceof StructureRequestError ? cause.status : 0;
        if ([401, 403, 404].includes(status)) {
          setTarget(null);
          onAccessLost(status);
        } else
          setError(
            code === "DUPLICATE_STRUCTURE"
              ? "structureDuplicate"
              : code === "STALE_STRUCTURE"
                ? "structureStale"
                : status === 400
                  ? "structureInvalid"
                  : "structureUncertain",
          );
      } finally {
        if (pending.current === controller) {
          pending.current = null;
          setBusy(false);
        }
      }
    },
  };
}
