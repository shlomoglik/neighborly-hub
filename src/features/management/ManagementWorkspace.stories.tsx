import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import type { DraftBuilding } from "./project-structure-draft";
import type { ManagementStatus } from "./use-management";

function Example({
  status = "ready",
  admin = true,
  empty = false,
  list = false,
  pendingCount,
}: {
  status?: ManagementStatus;
  admin?: boolean;
  empty?: boolean;
  list?: boolean;
  pendingCount?: number;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [buildingIds, setBuilding] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftBuilding[]>(() => [
    {
      id: "a",
      name: "בניין אלון - B1",
      address: "אלי כהן 5",
      floors: [
        { id: "f0", number: 0, name: "", type: "commercial", apartments: [] },
        {
          id: "f1",
          number: 1,
          name: "",
          type: "residential",
          apartments: [
            { id: "u2", number: "2", type: "residential" },
            { id: "u10", number: "10", type: "residential" },
          ],
        },
      ],
    },
    ...(admin ? [{ id: "b", name: "בניין תאנה - B1", address: "אלי כהן 7", floors: [] }] : []),
  ]);
  const project = { id: "synthetic-project", name: t("demoProject"), city: t("demoCity") };
  const buildings = empty ? [] : draft;
  return (
    <ManagementWorkspace
      onEdit={() => {}}
      mode={mode}
      onModeChange={setMode}
      status={status}
      selectedProjectId={list ? "" : project.id}
      buildingIds={buildingIds}
      discovery={
        ["loading", "expired", "error"].includes(status)
          ? null
          : {
              projects: (empty && list) || status === "forbidden" ? [] : [project],
              page: 1,
              hasNext: false,
              canCreateProject: admin,
              hasManagementAccess: status !== "forbidden",
            }
      }
      data={
        list
          ? null
          : {
              ...project,
              buildings,
              canAddBuilding: admin,
              counts: {
                buildings: buildings.length,
                floors: buildings.reduce((n, b) => n + b.floors.length, 0),
                apartments: buildings.reduce(
                  (n, b) => n + b.floors.reduce((n, f) => n + f.apartments.length, 0),
                  0,
                ),
              },
            }
      }
      onBuildingChange={setBuilding}
      onPageChange={() => {}}
      onRefresh={() => {}}
      structure={
        !list && buildings.length > 0 ? (
          <ProjectStructureEditor
            mode={mode}
            buildings={buildings.filter((b) => !buildingIds.length || buildingIds.includes(b.id))}
            projectName={project.name}
            onChange={(updated) =>
              setDraft((current) =>
                current.map((b) => updated.find((next) => next.id === b.id) ?? b),
              )
            }
            buildingOptions={buildings}
            selectedBuildingIds={buildingIds}
            onBuildingSelectionChange={setBuilding}
          />
        ) : null
      }
      pendingCount={pendingCount}
    />
  );
}
const meta = {
  title: "Features/Management/Workspace",
  component: Example,
  tags: ["autodocs"],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ProjectList: Story = { args: { list: true } };
export const Administrator: Story = {};
export const ScopedManager: Story = { args: { admin: false } };
export const Loading: Story = { args: { status: "loading" } };
export const EmptyProject: Story = { args: { empty: true } };
export const EmptyDiscovery: Story = { args: { empty: true, list: true, status: "empty" } };
export const NoManagementAccess: Story = { args: { admin: false, status: "forbidden" } };
export const Unavailable: Story = { args: { admin: false, status: "unavailable" } };
export const Expired: Story = { args: { status: "expired" } };
export const Error: Story = { args: { status: "error" } };
export const TabsWithPendingBadge: Story = { args: { pendingCount: 2 } };
export const TabsRussian: Story = { globals: { locale: "ru" } };
