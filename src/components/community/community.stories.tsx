import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useI18n } from "@/lib/i18n/context";
import { useState } from "react";
import { VisibilitySelector, type Visibility } from "./VisibilitySelector";
import { HouseholdRow } from "./HouseholdRow";
import { ApartmentMap, type ApartmentTileModel } from "./ApartmentMap";
import { JoinRequestCard } from "./JoinRequestCard";
import { BirthdayCard } from "./BirthdayCard";
import { SystemFeedback } from "./SystemFeedback";
import { StatusBadge, type ResidentStatus } from "./StatusBadge";
import { Button } from "../ui/button";
function PrivacyDemo({ restricted = false }: { restricted?: boolean }) {
  const [value, setValue] = useState<Visibility>("building");
  return <VisibilitySelector value={value} onChange={setValue} allowComplex={!restricted} />;
}
function MapDemo() {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string>();
  const statuses = ["occupied", "pending", "vacant", "absent-owner"] as const;
  const apartments: ApartmentTileModel[] = Array.from({ length: 24 }, (_, i) => ({
    id: String(i + 1),
    number: String(i + 1),
    floor: Math.floor(i / 4) + 1,
    status: statuses[i % 4],
    label: i % 4 === 0 ? t("demoFamily") : undefined,
  }));
  return <ApartmentMap apartments={apartments} selectedId={selectedId} onSelect={setSelectedId} />;
}
function RequestDemo() {
  const { t } = useI18n();
  const [status, setStatus] = useState<ResidentStatus>("pending");
  return status === "pending" ? (
    <JoinRequestCard
      request={{
        id: "1",
        familyName: t("demoFamily"),
        building: "2",
        apartment: "18",
        conflictWith: t("demoFamilyTwo"),
      }}
      onApprove={() => setStatus("approved")}
      onReject={() => setStatus("rejected")}
    />
  ) : (
    <div role="status" className="space-y-4">
      <StatusBadge status={status} />
      <Button variant="outline" onClick={() => setStatus("pending")}>
        {t("undo")}
      </Button>
    </div>
  );
}
function HouseholdDemo({ hidden = false }: { hidden?: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(false);
  return (
    <HouseholdRow
      selected={selected}
      onSelect={() => setSelected(!selected)}
      household={{
        id: "1",
        familyName: t("demoFamily"),
        building: "1",
        apartment: "12",
        isMine: true,
        ...(!hidden ? { phone: "0501234567", phoneVisible: true } : {}),
        birthdayLabel: t("tomorrow"),
      }}
    />
  );
}
function BirthdayDemo() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  return (
    <>
      <BirthdayCard
        name={t("demoPerson")}
        when={t("tomorrow")}
        age={9}
        date={new Date("2026-10-16T00:00:00Z")}
        onGreet={() => setSent(true)}
      />
      {sent && <p role="status">{t("successMessage")}</p>}
    </>
  );
}
function RetryDemo() {
  const [retry, setRetry] = useState(false);
  return (
    <SystemFeedback
      kind={retry ? "empty" : "error"}
      onRetry={retry ? undefined : () => setRetry(true)}
    />
  );
}
const meta = {
  title: "Features/Community/Building Blocks",
  component: PrivacyDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof PrivacyDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Privacy: Story = {};
export const RestrictedPrivacy: Story = { args: { restricted: true } };
export const BuildingMap: Story = { render: () => <MapDemo /> };
export const JoinRequest: Story = { render: () => <RequestDemo /> };
export const Household: Story = { render: () => <HouseholdDemo /> };
export const HiddenContact: Story = { render: () => <HouseholdDemo hidden /> };
export const Birthday: Story = { render: () => <BirthdayDemo /> };
export const Empty: Story = { render: () => <SystemFeedback kind="empty" /> };
export const Error: Story = { render: () => <RetryDemo /> };
export const Offline: Story = { render: () => <SystemFeedback kind="offline" /> };
export const Private: Story = { render: () => <SystemFeedback kind="private" /> };

export const Loading: Story = { render: () => <SystemFeedback kind="loading" /> };
function SuccessDemo() {
  const [done, setDone] = useState(true);
  return (
    <SystemFeedback
      kind={done ? "success" : "empty"}
      onUndo={done ? () => setDone(false) : undefined}
    />
  );
}
export const Success: Story = { render: () => <SuccessDemo /> };
