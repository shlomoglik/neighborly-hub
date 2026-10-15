import type { Meta, StoryObj } from "@storybook/react-vite";
import { DirectoryFilters } from "./DirectoryFilters";
const entries = [
  { id: "1", name: "משפחת כהן", building: "א", apartment: "12" },
  { id: "2", name: "משפחת לוי", building: "ב", apartment: "4" },
  { id: "3", name: "משפחת ישראלי", building: "א", apartment: "7" },
];
const meta = { title: "Features/Directory/Filters", component: DirectoryFilters, tags: ["autodocs"], args: { entries } } satisfies Meta<typeof DirectoryFilters>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Empty: Story = { args: { entries: [] } };
export const ManyEntries: Story = { args: { entries: Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `משפחה ${index + 1}`, building: index % 2 ? "א" : "ב", apartment: String(index + 1) })) } };
