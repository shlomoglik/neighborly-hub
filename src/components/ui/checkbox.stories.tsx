import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "./checkbox";
const meta = { title: "UI/Checkbox", component: Checkbox, tags: ["autodocs"], args: { "aria-label": "אישור תנאים" } } satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
