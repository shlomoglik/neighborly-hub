import type { Meta, StoryObj } from "@storybook/react-vite";
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
export const AddFloor: Story = {
  args: {
    target: { mode: "create", entity: "floor", buildingId: "c44c9aec-f8e4-46b3-9957-12ceba088994" },
  },
};
export const ChangeApartment: Story = {
  args: {
    target: {
      mode: "update",
      entity: "apartment",
      id: "c44c9aec-f8e4-46b3-9957-12ceba088994",
      expected: "2",
    },
  },
};
export const Saving: Story = { args: { busy: true } };
export const Revalidating: Story = { args: { refreshing: true } };
export const Duplicate: Story = { args: { error: "structureDuplicate" } };
export const Stale: Story = { args: { error: "structureStale" } };
export const Uncertain: Story = { args: { error: "structureUncertain" } };
