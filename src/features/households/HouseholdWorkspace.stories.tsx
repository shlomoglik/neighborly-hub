import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import { isLang, translate } from "@/lib/i18n/dictionary";
import { HouseholdWorkspace } from "./HouseholdWorkspace";
import type { HouseholdDetail } from "@/lib/access/household-contracts";
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

function EditableContacts() {
  const [contacts, setContacts] = useState<NonNullable<HouseholdDetail["ownContacts"]>>([
    meta.args.data.ownContacts[0],
    longContact,
  ]);
  return (
    <div className="mx-auto max-w-xs">
      <HouseholdWorkspace
        {...meta.args}
        data={{
          ...meta.args.data,
          ownContacts: contacts,
          members: [
            {
              ...meta.args.data.members[0],
              contacts: [{ kind: "email", value: longEmail }],
            },
          ],
        }}
        onSave={async (input) => {
          if (input.action !== "updateContact") return false;
          setContacts((saved) =>
            saved.map((contact) =>
              contact.id === input.id ? { id: contact.id, ...input.contact } : contact,
            ),
          );
          return true;
        }}
      />
    </div>
  );
}

export const InlineContacts: Story = {
  render: () => <EditableContacts />,
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const lang = isLang(globals.locale) ? globals.locale : "he";
    const edit = translate(lang, "homeEditContact", { value: longEmail });
    const label = translate(lang, "homeContactLabel");

    await userEvent.click(canvas.getByRole("button", { name: edit }));
    await userEvent.clear(canvas.getByLabelText(label));
    await userEvent.type(canvas.getByLabelText(label), "Discard this label");
    await userEvent.click(canvas.getByRole("button", { name: translate(lang, "cancel") }));
    await expect(canvas.getByRole("button", { name: edit })).toHaveFocus();

    await userEvent.click(canvas.getByRole("button", { name: edit }));
    await userEvent.clear(canvas.getByLabelText(label));
    await userEvent.type(canvas.getByLabelText(label), "Saved label");
    await userEvent.click(canvas.getByRole("radio", { name: translate(lang, "vis_building") }));
    await userEvent.click(canvas.getByRole("button", { name: translate(lang, "save") }));
    await expect(canvas.getByText("Saved label")).toBeVisible();
  },
};
export const InlineContactsLtr: Story = { ...InlineContacts, globals: { locale: "en" } };
