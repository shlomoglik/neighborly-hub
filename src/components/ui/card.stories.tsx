import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
function Example({ loading = false }: { loading?: boolean }) {
  return <Card className="w-full max-w-sm"><CardHeader><CardTitle>משפחת לוי</CardTitle><CardDescription>בניין 2 · דירה 14</CardDescription></CardHeader><CardContent>{loading ? "טוען פרטים..." : "4 דיירים רשומים"}</CardContent><CardFooter><Button disabled={loading}>הצגת פרטים</Button></CardFooter></Card>;
}
const meta = { title: "UI/Card", component: Example, tags: ["autodocs"] } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
