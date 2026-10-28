import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n";
import { InvitationWorkspace, type InvitationWorkspaceProps } from "./InvitationWorkspace";
import { JoinInvitation } from "./JoinInvitation";
import { InvitationShare } from "./InvitationShare";
import type { ResourceStatus } from "./use-invitation-resource";
import { ManageProjectHeader } from "@/features/management/ManageProjectHeader";
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
const apartmentId = "94864538-67d1-4f89-8ea5-3b4a707e9a32";
function Example({
  status = "ready",
  admin = true,
  empty = false,
}: {
  status?: ResourceStatus;
  admin?: boolean;
  empty?: boolean;
}) {
  const { t } = useI18n();
  const data: NonNullable<InvitationWorkspaceProps["data"]> = {
    hierarchy: {
      id: projectId,
      name: t("demoProject"),
      city: t("demoCity"),
      canAddBuilding: admin,
      counts: { buildings: 1, floors: 1, apartments: 1 },
      buildings: [
        {
          id: buildingId,
          name: t("demoBuilding"),
          floors: [{ id: "floor", number: 0, apartments: [{ id: apartmentId, number: "2" }] }],
        },
      ],
    },
    invitations: {
      invitations: empty
        ? []
        : [
            {
              id: "synthetic-invitation",
              kind: "resident",
              buildingId,
              apartmentId: null,
              recipientEmail: null,
              expiresAt: "2099-01-01T00:00:00.000Z",
              revoked: false,
              consumed: false,
            },
          ],
      canInviteStaff: admin,
      page: 1,
      hasNext: false,
    },
    requests: {
      requests: empty
        ? []
        : [
            {
              id: "synthetic-request",
              kind: "resident",
              projectId,
              projectName: t("demoProject"),
              buildingName: t("demoBuilding"),
              apartmentNumber: "2",
              fullName: t("demoPerson"),
              householdName: t("demoFamily"),
              status: "pending",
              accountName: t("demoPerson"),
              accountEmail: "resident@example.test",
              invitationActive: true,
              canReview: true,
            },
          ],
      page: 1,
      hasNext: false,
    },
  };
  return (
    <div className="space-y-6">
      <ManageProjectHeader
        project={data.hierarchy}
        active="invitations"
        canManageStaff={admin}
        pendingCount={
          data.requests.requests.filter((request) => request.status === "pending").length
        }
      />
      <InvitationWorkspace
        projectId={projectId}
        status={status}
        data={status === "ready" ? data : null}
        busy={false}
        error={null}
        created={null}
        onRenew={async () => {}}
        onInspectRecipient={async () => ({ account: "existing", role: "available" })}
        onCreate={async () => false}
        onRevoke={async () => {}}
        onReview={async () => false}
        onRefresh={() => {}}
        onInvitationPage={() => {}}
        onRequestPage={() => {}}
      />
    </div>
  );
}
const meta = {
  title: "Features/Management/InvitationWorkspace",
  component: Example,
  tags: ["autodocs"],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Administrator: Story = {};
export const ScopedManager: Story = { args: { admin: false } };
export const Empty: Story = { args: { empty: true } };
export const Loading: Story = { args: { status: "loading" } };
export const Unavailable: Story = { args: { status: "unavailable" } };
export const ExpiredSession: Story = { args: { status: "expired" } };
export const NetworkError: Story = { args: { status: "error" } };
export const ResidentJoin: Story = { render: () => <JoinExample /> };
export const PendingRequest: Story = { render: () => <JoinExample pending /> };
function JoinExample({ pending = false }: { pending?: boolean }) {
  const { t } = useI18n();
  return (
    <JoinInvitation
      status="ready"
      busy={false}
      error={null}
      data={{
        projectName: t("demoProject"),
        buildingName: t("demoBuilding"),
        kind: "resident",
        active: true,
        fixedApartmentId: apartmentId,
        apartments: [{ id: apartmentId, number: "2", floor: 0 }],
        page: 1,
        hasNext: false,
        request: pending ? { id: "synthetic", status: "pending" } : null,
      }}
      onSubmit={async () => {}}
      onRefresh={() => {}}
      onPage={() => {}}
    />
  );
}
export const PrintableShare: Story = {
  render: () => (
    <InvitationShare
      url={`https://example.test/join/${"a".repeat(64)}`}
      projectName="Synthetic project"
      contacts={[{ name: "Synthetic resident", phone: "0501234567" }]}
    />
  ),
};
