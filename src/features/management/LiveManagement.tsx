"use client";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { isStructureTargetAvailable } from "./structure-editor-model";
import { StructureEditor } from "./StructureEditor";
import { useStructureEditor } from "./use-structure-editor";
import { ManagedStructureEditor } from "./ManagedStructureEditor";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { useManagement } from "./use-management";

export function LiveManagement({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const workspace = useManagement(projectId);
  const { onBuildingChange } = workspace;
  const [layout, setLayout] = useState<{ data: ManagementHierarchy; initialId: string } | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [structureBusy, setStructureBusy] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const selectedId = workspace.buildingId || workspace.data?.buildings[0]?.id;
  const reset = () => {
    setLayout(null);
    setDirty(false);
    setStructureBusy(false);
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
  // Keep the original version and draft during revalidation; save still checks that version.
  useEffect(() => {
    if (workspace.status === "ready" && workspace.data && selectedId) {
      // Remember the default selection so losing that building never silently opens another.
      if (!workspace.buildingId) onBuildingChange(selectedId);
      if (!layout || layout.data.id !== projectId || layout.initialId !== selectedId)
        setLayout({ data: workspace.data, initialId: selectedId });
    } else if (workspace.status !== "loading" && layout) {
      setLayout(null);
      setDirty(false);
      setStructureBusy(false);
    }
  }, [
    workspace.status,
    workspace.data,
    workspace.buildingId,
    onBuildingChange,
    selectedId,
    layout,
    projectId,
  ]);
  const layoutAllowed =
    !!layout &&
    layout.data.id === projectId &&
    (workspace.status === "loading" ||
      (workspace.status === "ready" &&
        workspace.data?.buildings.some((b) => b.id === layout.initialId) &&
        layout.initialId === selectedId));
  return (
    <AppShell wide>
      <div ref={container} className="mx-auto min-w-0 max-w-7xl">
        <ManagementWorkspace
          status={workspace.status}
          discovery={workspace.discovery}
          data={workspace.data}
          selectedProjectId={workspace.selectedProjectId}
          buildingId={workspace.buildingId}
          onPageChange={workspace.onPageChange}
          onBuildingChange={(id) => {
            if (!structureBusy && discard()) {
              reset();
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
              <ManagedStructureEditor
                key={layout.data.id + ":" + layout.initialId}
                {...layout}
                refreshing={workspace.status === "loading" || !!target}
                onDirtyChange={setDirty}
                onBusyChange={setStructureBusy}
                onClose={reset}
                onSaved={refresh}
                onReload={refresh}
                onAccessLost={workspace.onAccessLost}
              />
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
