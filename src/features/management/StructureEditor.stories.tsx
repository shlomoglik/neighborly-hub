import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StructureEditor } from "./StructureEditor";
const meta = {
  title: "Features/Management/Structure editor",
  component: StructureEditor,
  tags: ["autodocs"],
  args: {
    target: { mode: "create", entity: "building" },
    busy: false,
    error: null,
    onSave: async () => {},
    onClose: () => {},
    onReload: () => {},
  },
} satisfies Meta<typeof StructureEditor>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AddBuilding: Story = {};
export const Saving: Story = { args: { busy: true } };
export const Revalidating: Story = { args: { refreshing: true } };
