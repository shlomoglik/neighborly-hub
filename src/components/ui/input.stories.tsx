import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "./input";
function Example({ invalid = false, disabled = false }: { invalid?: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <label htmlFor="sample-input">{t("email")}</label>
      <Input
        id="sample-input"
        type="email"
        dir="ltr"
        aria-invalid={invalid}
        aria-describedby={invalid ? "sample-error" : undefined}
        disabled={disabled}
      />
      {invalid && (
        <p id="sample-error" role="alert">
          {t("emailInvalid")}
        </p>
      )}
    </div>
  );
}
const meta = { title: "UI/Input", component: Example, tags: ["autodocs"] } satisfies Meta<
  typeof Example
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { invalid: true } };
