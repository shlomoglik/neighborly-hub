import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { Button, type ButtonProps } from "./button";
function Example(props: ButtonProps) {
  const { t } = useI18n();
  return (
    <Button {...props}>
      {props.disabled ? t("loading") : props.variant === "destructive" ? t("delete") : t("save")}
    </Button>
  );
}
const meta = { title: "UI/Button", component: Example, tags: ["autodocs"] } satisfies Meta<
  typeof Example
>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const Loading: Story = { args: { disabled: true, "aria-busy": true } };
export const Quiet: Story = { args: { variant: "ghost" } };
export const Link: Story = { args: { variant: "link" } };
