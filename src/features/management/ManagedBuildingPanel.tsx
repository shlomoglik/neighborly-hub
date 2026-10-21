"use client";
import { useEffect, useState } from "react";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { ManagedStructureEditor } from "./ManagedStructureEditor";

type Props = {
  data: ManagementHierarchy;
  buildingId: string;
  refreshing: boolean;
  onRefresh: () => void;
  onAccessLost: (status: number) => void;
  onStateChange: (id: string, dirty: boolean, busy: boolean) => void;
};

/** Each building keeps its own draft and original version across other buildings' saves. */
export function ManagedBuildingPanel(p: Props) {
  const [snapshot, setSnapshot] = useState(p.data);
  const [revision, setRevision] = useState(0);
  const [waiting, setWaiting] = useState<ManagementHierarchy | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const { onStateChange, buildingId, data, refreshing } = p;
  useEffect(() => {
    onStateChange(buildingId, dirty, busy || !!waiting);
  }, [onStateChange, buildingId, dirty, busy, waiting]);
  useEffect(() => () => onStateChange(buildingId, false, false), [buildingId, onStateChange]);
  useEffect(() => {
    if (waiting && !refreshing && data !== waiting) {
      setSnapshot(data);
      setRevision((n) => n + 1);
      setWaiting(null);
      setDirty(false);
      setBusy(false);
    }
  }, [waiting, refreshing, data]);
  const reload = () => {
    setWaiting(data);
    p.onRefresh();
  };
  return (
    <ManagedStructureEditor
      key={revision}
      data={snapshot}
      initialId={buildingId}
      refreshing={refreshing || !!waiting}
      onDirtyChange={setDirty}
      onBusyChange={setBusy}
      onClose={() => {
        setSnapshot(data);
        setRevision((n) => n + 1);
        setDirty(false);
      }}
      onSaved={reload}
      onReload={reload}
      onAccessLost={p.onAccessLost}
    />
  );
}
