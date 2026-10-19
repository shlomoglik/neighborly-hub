import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectSetupWizard } from "./ProjectSetupWizard";

const meta = {
  title: "Features/Management/Project Setup",
  component: ProjectSetupWizard,
  args: { onCreate: async () => ({ projectId: "c44c9aec-f8e4-46b3-9957-12ceba088994" }) },
} satisfies Meta<typeof ProjectSetupWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const Saving: Story = { args: { onCreate: () => new Promise(() => {}) } };
