import type { Meta, StoryObj } from "@storybook/react-vite";
import { useI18n } from "@/lib/i18n/context";
const colors = [
  "background",
  "card",
  "secondary",
  "sidebar",
  "border",
  "foreground",
  "muted-foreground",
  "primary",
  "accent",
  "warning",
  "destructive",
] as const;
function Foundations() {
  const { t } = useI18n();
  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-3xl">{t("foundations")}</h1>
      <section aria-label={t("palette")}>
        <h2 className="mb-4 text-xl">{t("palette")}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {colors.map((color) => (
            <div key={color} className="rounded-xl border bg-card p-3">
              <div
                className="h-16 rounded-lg border"
                style={{ backgroundColor: `var(--${color})` }}
              />
              <code className="mt-2 block break-all text-xs" dir="ltr">
                {color}
              </code>
            </div>
          ))}
        </div>
      </section>
      <section aria-label={t("typography")} className="space-y-3">
        <h2 className="text-xl">{t("typography")}</h2>
        <p className="font-heading text-3xl">{t("demoFamily")}</p>
        <p>{t("demoMixedNames")}</p>
        <p className="tabular-nums" dir="ltr">
          050-1234567 · 21
        </p>
      </section>
      <section aria-label={t("spacing")} className="flex flex-wrap items-end gap-4">
        {[4, 8, 12, 16, 24, 32, 48].map((n) => (
          <div key={n} className="rounded-lg bg-primary/15 p-2">
            <div className="bg-primary" style={{ width: n, height: n }} />
            <span>{n}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
const meta = { title: "Foundations/Neighborly 2b", component: Foundations } satisfies Meta<
  typeof Foundations
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
