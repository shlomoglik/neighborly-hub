import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { MemberEditor, emptyMember } from "./MemberEditor";
import { MemberRow } from "./MemberRow";
import { CommunityNavigation, type CommunityTab } from "./CommunityNavigation";
import { HouseholdPanel, HouseholdDetailsContent } from "./HouseholdPanel";
import { JoinSteps } from "./JoinSteps";
import { BuildingSelector } from "./BuildingSelector";
import { BirthdayBanner } from "./BirthdayBanner";
import { FamilyAvatar } from "../FamilyAvatar";
import { Button } from "../ui/button";
function EditorDemo({
  child = false,
  restricted = false,
  invalid = false,
}: {
  child?: boolean;
  restricted?: boolean;
  invalid?: boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(() => emptyMember(child));
  return (
    <MemberEditor
      value={draft}
      onChange={setDraft}
      allowComplex={!restricted}
      errors={
        invalid
          ? { name: t("required"), phone: t("phoneInvalid"), email: t("emailInvalid") }
          : undefined
      }
    />
  );
}
function NavigationDemo({ manager = false }: { manager?: boolean }) {
  const [active, setActive] = useState<CommunityTab>("directory");
  return <CommunityNavigation active={active} onChange={setActive} manager={manager} />;
}
function StepsDemo() {
  const [step, setStep] = useState<0 | 1 | 2>(2);
  return <JoinSteps current={step} onStep={setStep} />;
}
function PanelDemo() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Button onClick={() => setOpen(true)}>{t("viewDetails")}</Button>
      <HouseholdPanel open={open} onOpenChange={setOpen}>
        <HouseholdDetailsContent
          name={t("demoFamily")}
          building="2"
          apartment="21"
          floor="5"
          status="owner-resident"
          members={[
            {
              id: "1",
              name: t("demoPerson"),
              primary: true,
              contacts: [
                { kind: "phone", visible: true, visibility: "building", value: "0501234567" },
              ],
            },
            {
              id: "2",
              name: t("demoMixedName"),
              child: true,
              age: 9,
              contacts: [{ kind: "phone", visible: false }],
            },
          ]}
        />
      </HouseholdPanel>
    </div>
  );
}
function MembersDemo() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <MemberRow
        member={{
          id: "1",
          name: t("demoPerson"),
          primary: true,
          contacts: [
            { kind: "phone", visible: true, visibility: "building", value: "0501234567" },
            { kind: "email", visible: true, visibility: "building", value: "neighbor@example.com" },
          ],
        }}
      />
      <MemberRow
        member={{
          id: "2",
          name: t("demoMixedName"),
          child: true,
          age: 9,
          contacts: [{ kind: "phone", visible: false }],
        }}
      />
    </div>
  );
}
function AvatarsDemo() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <FamilyAvatar name={t("demoFamily")} />
      <FamilyAvatar name={t("demoRussianName")} />
      <FamilyAvatar name={t("demoEnglishName")} />
      <FamilyAvatar name={t("demoPerson")} className="rounded-full" />
      <div role="group" aria-label={t("family")} className="flex -space-x-2 rtl:space-x-reverse">
        <FamilyAvatar
          name={t("demoHebrewName")}
          size={44}
          className="rounded-full ring-2 ring-card"
        />
        <FamilyAvatar
          name={t("demoRussianPerson")}
          size={44}
          className="rounded-full ring-2 ring-card"
        />
      </div>
    </div>
  );
}
const meta = {
  title: "Features/Community/Composites",
  component: EditorDemo,
  tags: ["autodocs"],
} satisfies Meta<typeof EditorDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MemberForm: Story = {};
export const ChildPrivacy: Story = { args: { child: true } };
export const BuildingOnlyPolicy: Story = { args: { restricted: true } };
export const Validation: Story = { args: { invalid: true } };
export const Members: Story = { render: () => <MembersDemo /> };
export const ResidentNavigation: Story = { render: () => <NavigationDemo /> };
export const ManagerNavigation: Story = { render: () => <NavigationDemo manager /> };
export const Progress: Story = { render: () => <StepsDemo /> };
export const ResponsiveDetails: Story = { render: () => <PanelDemo /> };
export const Avatars: Story = { render: () => <AvatarsDemo /> };

function BuildingsDemo({ overflow = false }: { overflow?: boolean }) {
  const { t } = useI18n();
  const [building, setBuilding] = useState("");
  return (
    <BuildingSelector
      value={building}
      onChange={setBuilding}
      buildings={Array.from({ length: overflow ? 12 : 3 }, (_, index) => ({
        id: String(index + 1),
        name: overflow
          ? `${t("demoProject")} - ${t("building")} ${index + 1}`
          : `${t("building")} ${index + 1}`,
      }))}
    />
  );
}
function BannerDemo() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <BirthdayBanner count={3} onOpen={() => setOpen(!open)}>
        {t("demoPerson")} · {t("tomorrow")}
      </BirthdayBanner>
      {open && <p role="status">{t("birthdays")}</p>}
    </>
  );
}
export const BuildingTabs: Story = { render: () => <BuildingsDemo /> };
export const BuildingTabsOverflow: Story = { render: () => <BuildingsDemo overflow /> };
export const BirthdaySummary: Story = { render: () => <BannerDemo /> };
