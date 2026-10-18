"use client";
import { useEffect, useRef, useState } from "react";
import { isStructureTargetAvailable } from "./structure-editor-model";
import { StructureEditor } from "./StructureEditor";
import { useStructureEditor } from "./use-structure-editor";
import { BuildingLayoutEditor } from "./BuildingLayoutEditor";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { AppShell } from "@/components/AppShell";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { useManagement } from "./use-management";
export function LiveManagement({ projectId }: { projectId: string }) {
  const workspace = useManagement(projectId);
  const [layout, setLayout] = useState<{ data: ManagementHierarchy; initialId: string } | null>(
    null,
  );
  const editor = useStructureEditor(projectId, workspace.onRefresh, workspace.onAccessLost);
  const { target, onClose } = editor;
  const container = useRef<HTMLDivElement>(null);
  const allowed =
    workspace.status === "loading" ||
    (workspace.status === "ready" &&
      !!workspace.data &&
      (!target || isStructureTargetAvailable(workspace.data, target)));
  useEffect(() => {
    if (!allowed && target && !editor.busy) onClose();
  }, [allowed, target, editor.busy, onClose]);
  const layoutAllowed =
    workspace.status === "loading" ||
    (workspace.status === "ready" &&
      !!workspace.data &&
      !!layout &&
      layout.data.id === projectId &&
      layout.data.buildings.every((b) =>
        workspace.data!.buildings.some((current) => current.id === b.id),
      ));
  useEffect(() => {
    if (layout && (layout.data.id !== projectId || !layoutAllowed)) setLayout(null);
  }, [layout, layoutAllowed, projectId]);
  return (
    <AppShell>
      <div ref={container}>
        <ManagementWorkspace
          {...workspace}
          onEdit={editor.onOpen}
          editingBusy={editor.busy || !!layout}
          onLayout={(initialId) => {
            if (workspace.data) setLayout({ data: workspace.data, initialId });
          }}
        />
      </div>
      {layout && layout.data.id === projectId && layoutAllowed && (
        <BuildingLayoutEditor
          key={projectId}
          {...layout}
          refreshing={workspace.status === "loading"}
          onClose={() => setLayout(null)}
          onSaved={() => {
            setLayout(null);
            workspace.onRefresh();
          }}
          onReload={() => {
            setLayout(null);
            workspace.onRefresh();
          }}
          onAccessLost={workspace.onAccessLost}
        />
      )}
      {target && allowed && (
        <StructureEditor
          key={JSON.stringify(target)}
          {...editor}
          target={target}
          refreshing={workspace.status === "loading"}
          onRestoreFocus={() => container.current?.querySelector<HTMLHeadingElement>("h1")?.focus()}
          onReload={() => {
            editor.onClose();
            workspace.onRefresh();
          }}
        />
      )}
    </AppShell>
  );
}
