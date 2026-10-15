import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
const meta = { title: "UI/Input", component: Input, tags: ["autodocs"], args: { placeholder: "חיפוש שכנים..." } } satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "משפחת כהן" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "כתובת לא תקינה" } };
