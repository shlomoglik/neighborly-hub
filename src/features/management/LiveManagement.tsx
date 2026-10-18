"use client";
import { useEffect, useRef } from "react";
import { isStructureTargetAvailable } from "./structure-editor-model";
import { StructureEditor } from "./StructureEditor";
import { useStructureEditor } from "./use-structure-editor";
import { AppShell } from "@/components/AppShell";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { useManagement } from "./use-management";
export function LiveManagement({ projectId }: { projectId: string }) {
  const workspace = useManagement(projectId);
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
  return (
    <AppShell>
      <div ref={container}>
        <ManagementWorkspace {...workspace} onEdit={editor.onOpen} editingBusy={editor.busy} />
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
            workspace.onRefresh();
          }}
        />
      )}
    </AppShell>
  );
}
