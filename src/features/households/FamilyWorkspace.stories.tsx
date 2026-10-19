import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FamilyWorkspace } from "./FamilyWorkspace";
const meta = {
  title: "Community/Family management",
  component: FamilyWorkspace,
  args: {
    id: "fictional-home",
    status: "ready",
    busy: false,
    error: null,
    created: null,
    onRefresh: () => {},
    onPage: () => {},
    onInvitationPage: () => {},
    onMutate: async () => true,
    onInvite: async () => true,
    onRevoke: async () => true,
    data: {
      family: {
        id: "fictional-home",
        name: "Cohen family",
        projectName: "Demo project",
        page: 1,
        hasNext: false,
        canAdd: true,
        members: [
          {
            id: "adult",
            name: "Dana Cohen",
            relation: null,
            child: false,
            representative: true,
            editable: false,
          },
          {
            id: "child",
            name: "Noa Cohen",
            relation: "Daughter",
            child: true,
            representative: false,
            editable: true,
          },
        ],
      },
      invitations: { invitations: [], page: 1, hasNext: false, canInviteStaff: false },
    },
  },
} satisfies Meta<typeof FamilyWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Representative: Story = {};
export const Loading: Story = { args: { status: "loading", data: null } };
export const Denied: Story = { args: { status: "unavailable", data: null } };
export const Conflict: Story = { args: { error: "STALE_FAMILY" } };
export const Saving: Story = { args: { busy: true } };
