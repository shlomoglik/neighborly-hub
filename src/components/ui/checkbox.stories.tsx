import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { Checkbox } from "./checkbox";
import { useState } from "react";
function Example({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex min-h-11 items-center gap-3">
      <Checkbox
        disabled={disabled}
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
      />
      {t("acceptTerms")}
    </label>
  );
}
const meta = { title: "UI/Checkbox", component: Example, tags: ["autodocs"] } satisfies Meta<
  typeof Example
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Disabled: Story = { args: { disabled: true } };
