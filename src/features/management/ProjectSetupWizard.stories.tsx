import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProjectSetupWizard } from "./ProjectSetupWizard";

const meta = {
  title: "Features/Management/Project Setup",
  component: ProjectSetupWizard,
} satisfies Meta<typeof ProjectSetupWizard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};
