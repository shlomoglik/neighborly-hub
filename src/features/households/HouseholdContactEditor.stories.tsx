import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { isLang, translate } from "@/lib/i18n/dictionary";
import { ContactEditorForm } from "./HouseholdContactEditor";

const meta = {
  title: "Features/Households/ContactEditor",
  component: ContactEditorForm,
  args: {
    contacts: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        kind: "phone",
        value: "0501234567",
        visibility: "managers",
        label: null,
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        kind: "email",
        value: "resident@example.test",
        visibility: "building",
        label: "Home",
      },
    ],
    busy: false,
    error: null,
    backHref: "/household/fictional-home",
    onRefresh: fn(),
    onClearError: fn(),
    onSave: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ContactEditorForm>;

export default meta;

export const BulkEdit: StoryObj<typeof meta> = {
  play: async ({ args, canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const lang = isLang(globals.locale) ? globals.locale : "he";
    const phone = canvas.getByLabelText(translate(lang, "phone"));
    const email = canvas.getByLabelText(translate(lang, "email"));
    await userEvent.clear(phone);
    await userEvent.type(phone, "0507654321");
    await userEvent.clear(email);
    await userEvent.type(email, "updated@example.test");
    await userEvent.click(canvas.getByRole("button", { name: translate(lang, "save") }));
    await expect(args.onSave).toHaveBeenCalledWith({
      action: "saveContacts",
      changes: meta.args.contacts.map(({ id, ...expected }, index) => ({
        action: "updateContact",
        id,
        expected,
        contact: { ...expected, value: index === 0 ? "0507654321" : "updated@example.test" },
      })),
    });
  },
};
