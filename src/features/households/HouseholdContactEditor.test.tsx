// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
import type { SavedContact } from "@/lib/access/household-contracts";
import { ContactEditorForm } from "./HouseholdContactEditor";

const contacts: SavedContact[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "email",
    value: "self@example.test",
    label: null,
    visibility: "project",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    kind: "phone",
    value: "0501234567",
    label: "Mobile",
    visibility: "managers",
  },
];
const setup = (initial = contacts) => ({
  contacts: initial,
  busy: false,
  error: null as string | null,
  backHref: "/household/home",
  onRefresh: vi.fn(),
  onClearError: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
});
function localized(props: Parameters<typeof ContactEditorForm>[0]) {
  return (
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <ContactEditorForm {...props} />
    </I18nContext.Provider>
  );
}
afterEach(cleanup);
const save = () => screen.getByRole("button", { name: "Save" });

it("edits phone and email together with one Save and the original values for conflict detection", async () => {
  const props = setup();
  render(localized(props));
  expect(save()).toBeDisabled();
  fireEvent.change(screen.getByDisplayValue(contacts[0].value), {
    target: { value: "next@example.test" },
  });
  fireEvent.change(screen.getByDisplayValue(contacts[1].value), {
    target: { value: "0507654321" },
  });
  fireEvent.click(save());
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith({
      action: "saveContacts",
      changes: contacts.map(({ id, ...expected }, index) => ({
        action: "updateContact",
        id,
        expected,
        contact: { ...expected, value: index ? "0507654321" : "next@example.test" },
      })),
    }),
  );
});

it("defaults new details to managers, rejects invalid values and stages removals until Save", async () => {
  const props = setup([contacts[0]]);
  render(localized(props));
  fireEvent.click(screen.getByRole("button", { name: "Add contact detail" }));
  const draft = within(screen.getByRole("group", { name: "Add contact detail" }));
  expect(draft.getByRole("radio", { name: translate("en", "vis_managers") })).toBeChecked();
  fireEvent.change(screen.getByLabelText(translate("en", "phone")), { target: { value: "-----" } });
  expect(save()).toBeDisabled();
  fireEvent.change(screen.getByLabelText(translate("en", "phone")), {
    target: { value: "0501234567" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete self@example.test" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
  expect(props.onSave).not.toHaveBeenCalled();
  fireEvent.click(save());
  const { id, ...expected } = contacts[0];
  await waitFor(() =>
    expect(props.onSave).toHaveBeenCalledExactlyOnceWith({
      action: "saveContacts",
      changes: [
        { action: "deleteContact", id, expected },
        {
          action: "addContact",
          contact: { kind: "phone", value: "0501234567", label: null, visibility: "managers" },
        },
      ],
    }),
  );
});

it("preserves the draft through refresh and conflicts, and clears it when edit rights are revoked", () => {
  const props = setup();
  const { rerender } = render(localized(props));
  fireEvent.change(screen.getByDisplayValue(contacts[0].value), {
    target: { value: "draft@example.test" },
  });
  rerender(localized({ ...props, contacts: undefined }));
  expect(screen.queryByDisplayValue("draft@example.test")).toBeNull();
  rerender(localized({ ...props, error: "STALE_HOUSEHOLD" }));
  expect(screen.getByDisplayValue("draft@example.test")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(translate("en", "homeStale"));
  expect(save()).toBeDisabled();
  expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/household/home");
  rerender(localized({ ...props, contacts: null }));
  expect(screen.queryByDisplayValue("draft@example.test")).toBeNull();
  rerender(localized(props));
  expect(screen.getByDisplayValue(contacts[0].value)).toBeVisible();
});
