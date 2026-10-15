import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";
const meta = { title: "UI/Badge", component: Badge, tags: ["autodocs"], args: { children: "פעיל" } } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "ממתין" } };
export const Destructive: Story = { args: { variant: "destructive", children: "שגיאה" } };
export const Outline: Story = { args: { variant: "outline", children: "טיוטה" } };
