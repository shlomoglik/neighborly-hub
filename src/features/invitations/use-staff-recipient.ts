"use client";
import { useEffect, useState } from "react";
import type { StaffInput, StaffRecipient } from "@/lib/access/staff-contracts";
export function useStaffRecipient(
  input: StaffInput | null,
  inspect: (input: StaffInput, signal: AbortSignal) => Promise<StaffRecipient>,
) {
  const key = JSON.stringify(input);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: StaffRecipient | null;
    failed: boolean;
  }>({ key: "", data: null, failed: false });
  useEffect(() => {
    if (!input) {
      setSnapshot({ key, data: null, failed: false });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void inspect(input, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setSnapshot({ key, data, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setSnapshot({ key, data: null, failed: true });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The serialized, normalized input defines the entire inspection scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, inspect]);
  return snapshot.key === key ? snapshot : { key, data: null, failed: false };
}
