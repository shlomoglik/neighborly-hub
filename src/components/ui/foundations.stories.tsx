import type { Meta, StoryObj } from "@storybook/react-vite";

const colors = [
  ["Background", "bg-background", "text-foreground"],
  ["Card", "bg-card", "text-card-foreground"],
  ["Primary", "bg-primary", "text-primary-foreground"],
  ["Secondary", "bg-secondary", "text-secondary-foreground"],
  ["Muted", "bg-muted", "text-muted-foreground"],
  ["Accent", "bg-accent", "text-accent-foreground"],
  ["Destructive", "bg-destructive", "text-destructive-foreground"],
  ["Success", "bg-success", "text-success-foreground"],
  ["Warning", "bg-warning", "text-warning-foreground"],
] as const;

function Foundations() {
  return (
    <main className="space-y-10 font-sans">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold">Design foundations</h1>
        <p className="text-muted-foreground">
          Semantic tokens from src/styles.css. Change the Storybook locale to inspect text direction.
        </p>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Colors</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colors.map(([name, background, foreground]) => (
            <div key={name} className="overflow-hidden rounded-lg border border-border">
              <div className={`flex h-24 items-center justify-center ${background} ${foreground}`}>
                {name}
              </div>
              <div className="bg-card p-3 text-sm text-card-foreground">
                <div className="font-medium">{name}</div>
                <code className="text-muted-foreground">{background}</code>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Typography</h2>
        <div className="space-y-3">
          <p className="text-3xl font-bold">כותרת ראשית — Heading</p>
          <p className="text-xl font-semibold">כותרת משנית — Subheading</p>
          <p className="text-base">ניהול קהילה ושכנים — Body text</p>
          <p className="text-sm text-muted-foreground">טקסט משני — Secondary text</p>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Radius and elevation</h2>
        <div className="flex flex-wrap gap-6">
          <div className="rounded-sm border border-border bg-card p-8">Small</div>
          <div className="rounded-lg border border-border bg-card p-8">Large</div>
          <div className="rounded-xl border border-border bg-card p-8 shadow-warm">Warm shadow</div>
        </div>
      </section>
    </main>
  );
}

const meta = {
  title: "Foundations/Design Tokens",
  component: Foundations,
  tags: ["autodocs"],
} satisfies Meta<typeof Foundations>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
