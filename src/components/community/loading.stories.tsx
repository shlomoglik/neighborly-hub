import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { CommunityLoading, CommunitySkeleton, type SkeletonVariant } from "./CommunityLoading";
import { HouseholdRow } from "./HouseholdRow";
import { Button } from "../ui/button";
function LoadingDemo({ variant = "household" }: { variant?: SkeletonVariant }) {
  return <CommunitySkeleton variant={variant} />;
}
function TransitionDemo() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  return (
    <div className="space-y-4">
      <Button variant="outline" onClick={() => setLoading(!loading)}>
        {loading ? t("viewDetails") : t("loading")}
      </Button>
      <CommunityLoading loading={loading} variant="household">
        <HouseholdRow
          household={{ id: "1", familyName: t("demoFamily"), building: "1", apartment: "12" }}
        />
      </CommunityLoading>
    </div>
  );
}
function BusyDemo() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-3">
      <Button loading={busy} onClick={() => setBusy(true)}>
        {busy ? t("loadingSubmit") : t("submit")}
      </Button>
      {busy && (
        <Button variant="outline" onClick={() => setBusy(false)}>
          {t("cancel")}
        </Button>
      )}
    </div>
  );
}
const meta = {
  title: "Features/Community/Loading and Motion",
  component: LoadingDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof LoadingDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Household: Story = {};
export const Member: Story = { args: { variant: "member" } };
export const Birthday: Story = { args: { variant: "birthday" } };
export const Details: Story = { args: { variant: "details" } };
export const BuildingMap: Story = { args: { variant: "map" } };
export const Form: Story = { args: { variant: "form" } };
export const Navigation: Story = { args: { variant: "navigation" } };
export const Request: Story = { args: { variant: "request" } };
export const Directory: Story = { args: { variant: "directory" } };
export const LoadingToContent: Story = { render: () => <TransitionDemo /> };
export const BusyButton: Story = { render: () => <BusyDemo /> };
