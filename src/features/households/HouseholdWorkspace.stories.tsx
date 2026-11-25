import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { isLang, translate } from "@/lib/i18n/dictionary";
import { HouseholdWorkspace } from "./HouseholdWorkspace";
import { ContactEditorForm } from "./HouseholdContactEditor";

const meta = {
  title: "Features/Households/HouseholdWorkspace",
  component: HouseholdWorkspace,
  args: {
    status: "ready",
    busy: false,
    error: null,
    onRefresh: () => {},
    onPage: () => {},
    onSave: async () => true,
    data: {
      id: "fictional-home",
      name: "Cohen family",
      project: "Demo community",
      building: "A",
      apartment: "12",
      floor: 2,
      canRename: true,
      ownPersonId: "fictional-person",
      ownContacts: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          kind: "phone",
          value: "0501234567",
          label: null,
          visibility: "managers",
        },
      ],
      members: [
        {
          id: "fictional-person",
          name: "Dana Cohen",
          primary: true,
          contacts: [{ kind: "phone", value: "0501234567" }],
        },
      ],
      page: 1,
      hasNext: false,
    },
  },
} satisfies Meta<typeof HouseholdWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Representative: Story = {};
export const Neighbor: Story = {
  args: {
    data: {
      ...meta.args.data,
      canRename: false,
      ownPersonId: null,
      ownContacts: null,
      members: [{ id: "fictional-person", name: "Dana Cohen", primary: true, contacts: [] }],
    },
  },
};
export const Loading: Story = { args: { status: "loading", data: null } };
export const Unavailable: Story = { args: { status: "unavailable", data: null } };
export const Expired: Story = { args: { status: "expired", data: null } };
export const Conflict: Story = { args: { error: "STALE_HOUSEHOLD" } };

export const SoloResident: Story = {
  args: { data: { ...meta.args.data, name: "Dana" } },
};
export const Roommates: Story = {
  args: {
    data: {
      ...meta.args.data,
      name: "Apartment 12 roommates",
      members: [
        ...meta.args.data.members,
        { id: "fictional-roommate", name: "Alex Levi", primary: false, contacts: [] },
      ],
    },
  },
};

const longEmail = "a.very.long.contact.address.for.this.example@neighborhood.example.test";
const longContact = {
  id: "00000000-0000-4000-8000-000000000002",
  kind: "email",
  value: longEmail,
  label: "A long label for this fictional contact",
  visibility: "project",
} as const;

export const LongContactOnMobile: Story = {
  args: {
    data: {
      ...meta.args.data,
      ownContacts: [...meta.args.data.ownContacts, longContact],
    },
  },
  render: (args) => (
    <div className="mx-auto w-full max-w-[280px]">
      <HouseholdWorkspace {...args} />
    </div>
  ),
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const lang = isLang(globals.locale) ? globals.locale : "he";
    const edit = canvas.getByRole("link", { name: translate(lang, "homeEditContacts") });
    const address = canvas.getByRole("button", { name: longEmail });
    const mail = canvas.getByRole("link", { name: translate(lang, "mail") });
    await expect(edit).toHaveAttribute("href", "/household/fictional-home/contacts/edit");
    await expect(address.closest("article")).toBe(edit.closest("article"));
    await expect(address.scrollWidth).toBeGreaterThan(address.clientWidth);
    const valueBounds = address.getBoundingClientRect();
    const actionBounds = mail.getBoundingClientRect();
    await expect(actionBounds.top).toBeLessThan(valueBounds.bottom);
    await expect(actionBounds.bottom).toBeGreaterThan(valueBounds.top);
    await userEvent.click(address);
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("tooltip"),
    ).toHaveTextContent(longEmail);
  },
};

export const LongContactOnMobileLtr: Story = { ...LongContactOnMobile, globals: { locale: "en" } };

export const BulkEdit: Story = {
  render: () => (
    <ContactEditorForm
      contacts={[...meta.args.data.ownContacts, longContact]}
      busy={false}
      error={null}
      backHref="/household/fictional-home"
      onSave={async () => {}}
      onRefresh={meta.args.onRefresh}
      onClearError={meta.args.onRefresh}
    />
  ),
};
