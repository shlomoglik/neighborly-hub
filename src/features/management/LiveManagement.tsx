"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { isStructureTargetAvailable } from "./structure-editor-model";
import { StructureEditor } from "./StructureEditor";
import { useStructureEditor } from "./use-structure-editor";
import { ManagedBuildingPanel } from "./ManagedBuildingPanel";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { useManagement } from "./use-management";

export function LiveManagement({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const workspace = useManagement(projectId);
  const [layout, setLayout] = useState<{ data: ManagementHierarchy } | null>(null);
  const [states, setStates] = useState<Record<string, { dirty: boolean; busy: boolean }>>({});
  const [revision, setRevision] = useState(0);
  const dirty = Object.values(states).some((state) => state.dirty);
  const structureBusy = Object.values(states).some((state) => state.busy);
  const onStateChange = useCallback((id: string, dirty: boolean, busy: boolean) => {
    setStates((current) =>
      current[id]?.dirty === dirty && current[id]?.busy === busy
        ? current
        : { ...current, [id]: { dirty, busy } },
    );
  }, []);
  const container = useRef<HTMLDivElement>(null);
  const reset = () => {
    setStates({});
    setRevision((n) => n + 1);
  };
  const refresh = () => {
    reset();
    workspace.onRefresh();
  };
  const discard = () => !dirty || window.confirm(t("managementDiscardChanges"));
  const editor = useStructureEditor(projectId, refresh, workspace.onAccessLost);
  const { target, onClose } = editor;
  const allowed =
    workspace.status === "loading" ||
    (workspace.status === "ready" &&
      !!workspace.data &&
      (!target || isStructureTargetAvailable(workspace.data, target)));
  useEffect(() => {
    if (!allowed && target && !editor.busy) onClose();
  }, [allowed, target, editor.busy, onClose]);
  // Revalidation updates authorized data; each panel retains its own unsaved draft.
  useEffect(() => {
    if (workspace.status === "ready" && workspace.data) {
      setLayout({ data: workspace.data });
    } else if (workspace.status !== "loading") {
      setLayout(null);
      setStates({});
    }
  }, [workspace.status, workspace.data]);
  const layoutAllowed =
    !!layout &&
    layout.data.id === projectId &&
    (workspace.status === "loading" || workspace.status === "ready");
  const buildings =
    layout?.data.buildings.filter(
      (b) =>
        (!workspace.buildingIds.length || workspace.buildingIds.includes(b.id)) &&
        (workspace.status === "loading" ||
          !!workspace.data?.buildings.some((current) => current.id === b.id)),
    ) ?? [];
  return (
    <AppShell wide>
      <div ref={container} className="mx-auto min-w-0 max-w-7xl">
        <ManagementWorkspace
          status={workspace.status}
          discovery={workspace.discovery}
          data={workspace.data}
          selectedProjectId={workspace.selectedProjectId}
          buildingIds={workspace.buildingIds}
          onPageChange={workspace.onPageChange}
          onBuildingChange={(id) => {
            if (!structureBusy && discard()) {
              setStates({});
              setRevision((n) => n + 1);
              workspace.onBuildingChange(id);
            }
          }}
          onRefresh={() => {
            if (!structureBusy && discard()) refresh();
          }}
          onEdit={(target) => {
            if (!structureBusy && discard()) {
              reset();
              editor.onOpen(target);
            }
          }}
          editingBusy={editor.busy || structureBusy}
          structure={
            layout && layoutAllowed ? (
              <div key={revision} className="min-w-0 space-y-6">
                {buildings.map((building) => (
                  <ManagedBuildingPanel
                    key={building.id}
                    data={layout.data}
                    buildingId={building.id}
                    refreshing={
                      workspace.status === "loading" ||
                      !!target ||
                      (structureBusy && !states[building.id]?.busy)
                    }
                    onStateChange={onStateChange}
                    onRefresh={workspace.onRefresh}
                    onAccessLost={workspace.onAccessLost}
                  />
                ))}
              </div>
            ) : null
          }
        />
      </div>
      {target && allowed && (
        <StructureEditor
          key={JSON.stringify(target)}
          {...editor}
          target={target}
          refreshing={workspace.status === "loading"}
          onRestoreFocus={() => container.current?.querySelector<HTMLHeadingElement>("h1")?.focus()}
          onReload={() => {
            editor.onClose();
            refresh();
          }}
        />
      )}
    </AppShell>
  );
}
