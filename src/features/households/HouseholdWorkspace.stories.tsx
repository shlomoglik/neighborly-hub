import type { Meta, StoryObj } from "@storybook/react-vite";
import { HouseholdWorkspace } from "./HouseholdWorkspace";
const meta = {
  title: "Community/Live household",
  component: HouseholdWorkspace,
  args: {
    status: "ready",
    busy: false,
    error: null,
    onRefresh: () => {},
    onPage: () => {},
    onSave: async () => true,
    data: {
      id: "fictional-home",
      name: "Cohen family",
      project: "Demo community",
      building: "A",
      apartment: "12",
      floor: 2,
      canRename: true,
      ownContacts: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          kind: "phone",
          value: "0501234567",
          label: null,
          visibility: "managers",
        },
      ],
      members: [
        {
          id: "fictional-person",
          name: "Dana Cohen",
          primary: true,
          contacts: [{ kind: "phone", value: "0501234567" }],
        },
      ],
      page: 1,
      hasNext: false,
    },
  },
} satisfies Meta<typeof HouseholdWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Representative: Story = {};
export const Neighbor: Story = {
  args: {
    data: {
      ...meta.args.data,
      canRename: false,
      ownContacts: null,
      members: [{ id: "fictional-person", name: "Dana Cohen", primary: true, contacts: [] }],
    },
  },
};
export const Loading: Story = { args: { status: "loading", data: null } };
export const Unavailable: Story = { args: { status: "unavailable", data: null } };
export const Expired: Story = { args: { status: "expired", data: null } };
export const Conflict: Story = { args: { error: "STALE_HOUSEHOLD" } };
