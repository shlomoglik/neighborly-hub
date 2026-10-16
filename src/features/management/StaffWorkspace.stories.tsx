import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useI18n } from "@/lib/i18n";
import type { StaffPage } from "@/lib/access/staff-contracts";
import { StaffWorkspace } from "./StaffWorkspace";
import type { StaffStatus } from "./use-staff";
function Example({
  status = "ready",
  empty = false,
  busy = false,
}: {
  status?: StaffStatus;
  empty?: boolean;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
  const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
  const [assignments, setAssignments] = useState<StaffPage["assignments"]>(
    empty
      ? []
      : [
          {
            id: "project-assignment",
            name: t("demoPerson"),
            email: "manager@example.test",
            role: "project_manager",
            buildingId: null,
          },
          {
            id: "building-assignment",
            name: t("demoPersonTwo"),
            email: "committee@example.test",
            role: "building_manager",
            buildingId,
          },
        ],
  );
  return (
    <StaffWorkspace
      projectId={projectId}
      status={status}
      busy={busy}
      notice={null}
      data={
        status === "ready"
          ? {
              project: { id: projectId, name: t("demoProject") },
              buildings: [{ id: buildingId, name: t("demoBuilding") }],
              assignments,
              page: 1,
              hasNext: false,
            }
          : null
      }
      onAdd={async (input) => {
        setAssignments((items) => [
          ...items,
          { id: String(items.length), name: t("demoPerson"), ...input },
        ]);
        return true;
      }}
      onRemove={async (id) => {
        setAssignments((items) => items.filter((a) => a.id !== id));
        return true;
      }}
      onRefresh={() => {}}
      onPageChange={() => {}}
    />
  );
}
const meta = {
  title: "Features/Management/Staff assignments",
  component: Example,
  tags: ["autodocs"],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Administrator: Story = {};
export const Empty: Story = { args: { empty: true } };
export const Saving: Story = { args: { busy: true } };
export const Loading: Story = { args: { status: "loading" } };
export const Forbidden: Story = { args: { status: "forbidden" } };
export const Unavailable: Story = { args: { status: "unavailable" } };
export const SessionExpired: Story = { args: { status: "expired" } };
export const Error: Story = { args: { status: "error" } };
