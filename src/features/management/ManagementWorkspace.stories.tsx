import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useI18n } from "@/lib/i18n";
import { ManagementWorkspace } from "./ManagementWorkspace";
import type { ManagementStatus } from "./use-management";
function Example({
  status = "ready",
  admin = true,
  empty = false,
}: {
  status?: ManagementStatus;
  admin?: boolean;
  empty?: boolean;
}) {
  const { t } = useI18n();
  const [buildingId, setBuilding] = useState("");
  const project = { id: "synthetic-project", name: t("demoProject"), city: t("demoCity") };
  return (
    <ManagementWorkspace
      status={status}
      selectedProjectId={project.id}
      buildingId={buildingId}
      discovery={
        status === "loading" || status === "expired" || status === "error"
          ? null
          : {
              projects: empty || status === "forbidden" ? [] : [project],
              page: 1,
              hasNext: false,
              canCreateProject: admin,
              hasManagementAccess: status !== "forbidden",
            }
      }
      data={
        empty
          ? { ...project, buildings: [], counts: { buildings: 0, floors: 0, apartments: 0 } }
          : {
              ...project,
              buildings: [
                {
                  id: "a",
                  name: t("demoBuilding"),
                  floors: [
                    { id: "f0", number: 0, apartments: [] },
                    {
                      id: "f1",
                      number: 1,
                      apartments: [
                        { id: "u2", number: "2" },
                        { id: "u10", number: "10" },
                      ],
                    },
                  ],
                },
                ...(admin ? [{ id: "b", name: t("demoBuilding") + " 2", floors: [] }] : []),
              ],
              counts: { buildings: admin ? 2 : 1, floors: 2, apartments: 2 },
            }
      }
      onBuildingChange={setBuilding}
      onPageChange={() => {}}
      onRefresh={() => {}}
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
export const Administrator: Story = {};
export const ScopedManager: Story = { args: { admin: false } };
export const Loading: Story = { args: { status: "loading" } };
export const EmptyProject: Story = { args: { empty: true } };
export const EmptyDiscovery: Story = { args: { empty: true, status: "empty" } };
export const NoManagementAccess: Story = { args: { admin: false, status: "forbidden" } };
export const Unavailable: Story = { args: { admin: false, status: "unavailable" } };
export const Expired: Story = { args: { admin: false, status: "expired" } };
export const Error: Story = { args: { status: "error" } };
