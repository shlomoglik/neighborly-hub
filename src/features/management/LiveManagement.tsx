"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { ProjectManagementContext } from "./ProjectManagementContext";
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
  const shared = useContext(ProjectManagementContext);
  return shared ? (
    <ManagementContent projectId={projectId} workspace={shared} />
  ) : (
    <StandaloneManagement projectId={projectId} />
  );
}

function StandaloneManagement({ projectId }: { projectId: string }) {
  const workspace = useManagement(projectId);
  return (
    <AppShell wide>
      <ManagementContent projectId={projectId} workspace={workspace} />
    </AppShell>
  );
}

function ManagementContent({
  projectId,
  workspace,
}: {
  projectId: string;
  workspace: ReturnType<typeof useManagement>;
}) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<{ data: ManagementHierarchy } | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [dirty, setDirty] = useState(false);
  const [structureBusy, setStructureBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const reset = () => {
    setDirty(false);
    setStructureBusy(false);
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
  // Keep authorized data during revalidation; the shared editor retains building drafts.
  useEffect(() => {
    if (workspace.status === "ready" && workspace.data) {
      setLayout({ data: workspace.data });
    } else if (workspace.status !== "loading") {
      setLayout(null);
      setMode("view");
      setDirty(false);
      setStructureBusy(false);
    }
  }, [workspace.status, workspace.data]);
  const layoutAllowed =
    !!layout &&
    layout.data.id === projectId &&
    (workspace.status === "loading" || workspace.status === "ready");
  const structureData = workspace.status === "ready" ? workspace.data : layout?.data;
  return (
    <>
      <div ref={container} className="mx-auto min-w-0 max-w-7xl">
        <ManagementWorkspace
          status={workspace.status}
          discovery={workspace.discovery}
          data={workspace.data}
          selectedProjectId={workspace.selectedProjectId}
          buildingIds={workspace.buildingIds}
          onPageChange={workspace.onPageChange}
          mode={mode}
          onModeChange={(next) => {
            if (
              workspace.status === "ready" &&
              !structureBusy &&
              !editor.busy &&
              !target &&
              discard()
            ) {
              reset();
              setMode(next);
            }
          }}
          onBuildingChange={(id) => {
            if (!structureBusy && discard()) {
              setDirty(false);
              setStructureBusy(false);
              setRevision((n) => n + 1);
              workspace.onBuildingChange(id);
            }
          }}
          onRefresh={() => {
            if (!structureBusy && discard()) refresh();
          }}
          onEdit={(target) => {
            if (mode === "edit" && !structureBusy && discard()) {
              reset();
              editor.onOpen(target);
            }
          }}
          editingBusy={editor.busy || structureBusy || !!target}
          structure={
            structureData && layoutAllowed ? (
              <ManagedStructureEditor
                key={`${projectId}:${mode}:${revision}`}
                data={structureData}
                mode={mode}
                buildingIds={workspace.buildingIds}
                refreshing={workspace.status === "loading" || !!target}
                onDirtyChange={setDirty}
                onBusyChange={setStructureBusy}
                onBuildingChange={(ids) => {
                  if (!structureBusy) workspace.onBuildingChange(ids);
                }}
                onSaved={workspace.onRefresh}
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
    </>
  );
}
