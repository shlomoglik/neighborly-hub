import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { Button } from "./button";
function Example({ loading = false }: { loading?: boolean }) {
  const { t } = useI18n();
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("demoFamily")}</CardTitle>
        <CardDescription>
          {t("building")} 2 · {t("apartment")} 14
        </CardDescription>
      </CardHeader>
      <CardContent>{loading ? t("loading") : t("demoCount")}</CardContent>
      <CardFooter>
        <Button disabled={loading}>{t("viewDetails")}</Button>
      </CardFooter>
    </Card>
  );
}
const meta = { title: "UI/Card", component: Example, tags: ["autodocs"] } satisfies Meta<
  typeof Example
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
