import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { StatusBadge } from "../community/StatusBadge";
const meta = {
  title: "UI/Badge",
  component: StatusBadge,
  tags: ["autodocs"],
  args: { status: "approved" },
} satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Approved: Story = {};
export const Pending: Story = { args: { status: "pending" } };
export const Rejected: Story = { args: { status: "rejected" } };
export const Tenant: Story = { args: { status: "tenant" } };
export const Owner: Story = { args: { status: "owner-resident" } };
export const AbsentOwner: Story = { args: { status: "owner-absent" } };
