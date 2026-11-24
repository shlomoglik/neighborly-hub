// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { HouseholdWorkspace, type HouseholdWorkspaceProps } from "./HouseholdWorkspace";
const props = (): HouseholdWorkspaceProps => ({
  status: "ready",
  busy: false,
  error: null,
  onRefresh: vi.fn(),
  onPage: vi.fn(),
  onSave: vi.fn().mockResolvedValue(true),
  data: {
    id: "home",
    name: "Family",
    project: "Project",
    building: "A",
    apartment: "1A",
    floor: 0,
    canRename: true,
    ownContacts: [],
    members: [{ id: "adult", name: "Adult", primary: true, contacts: [] }],
    page: 1,
    hasNext: false,
  },
});
function localized(value: HouseholdWorkspaceProps, lang: Lang = "en") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <HouseholdWorkspace {...value} />
    </I18nContext.Provider>
  );
}
afterEach(cleanup);
it.each(["he", "en", "ru"] as const)(
  "renders real authorized household data and edit capabilities in %s",
  (lang) => {
    const value = props();
    render(localized(value, lang));
    expect(screen.getByText("Family")).toBeTruthy();
    expect(screen.getByText("Adult")).toBeTruthy();
    expect(screen.getByRole("button", { name: translate(lang, "homeRename") })).toBeTruthy();
    expect(screen.getByText(translate(lang, "homeGlobalContacts"))).toBeTruthy();
  },
);
it("hides editors for directory viewers and discards stale data during loading/denial", () => {
  const value = props();
  value.data = { ...value.data!, canRename: false, ownContacts: null };
  const { rerender } = render(localized(value));
  expect(screen.queryByRole("button", { name: "Edit household name" })).toBeNull();
  expect(screen.queryByText("My contact details")).toBeNull();
  rerender(localized({ ...value, status: "loading" }));
  expect(screen.queryByText("Family")).toBeNull();
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  rerender(localized({ ...value, status: "unavailable" }));
  expect(screen.queryByText("Adult")).toBeNull();
});
it("submits renamed household with its original value for conflict detection", async () => {
  const value = props();
  render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Edit household name" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New family" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(value.onSave).toHaveBeenCalledWith({
      action: "rename",
      name: "New family",
      expected: "Family",
    }),
  );
  expect(await screen.findByText("Changes saved.")).toBeTruthy();
});
it("defaults new contact privacy to managers and validates values before writing", async () => {
  const value = props();
  render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Add contact detail" }));
  expect(screen.getByRole("radio", { name: translate("en", "vis_managers") })).toHaveProperty(
    "checked",
    true,
  );
  fireEvent.change(screen.getByLabelText(translate("en", "phone")), { target: { value: "-----" } });
  const save = screen.getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();
  fireEvent.click(save);
  expect(value.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.change(screen.getByLabelText(translate("en", "phone")), {
    target: { value: "0501234567" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(value.onSave).toHaveBeenCalledWith({
      action: "addContact",
      contact: { kind: "phone", value: "0501234567", label: null, visibility: "managers" },
    }),
  );
});
it("retains drafts through revalidation, shows conflicts, and clears editing when access is revoked", () => {
  const value = props();
  const { rerender } = render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Edit household name" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Draft" } });
  rerender(localized({ ...value, status: "loading", data: null }));
  expect(screen.queryByRole("textbox")).toBeNull();
  rerender(localized({ ...value, error: "STALE_HOUSEHOLD" }));
  expect(screen.getByRole("textbox")).toHaveProperty("value", "Draft");
  expect(screen.getByRole("alert").textContent).toContain("changed since editing");
  rerender(localized({ ...value, status: "unavailable", data: null }));
  rerender(localized(value));
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("requires deletion confirmation and blocks controls while saving", async () => {
  const value = props();
  const contact = {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "email" as const,
    value: "self@example.test",
    label: null,
    visibility: "project" as const,
  };
  value.data!.ownContacts = [contact];
  const { rerender } = render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Delete self@example.test" }));
  expect(value.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(value.onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete self@example.test" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const { id, ...expected } = contact;
  await waitFor(() =>
    expect(value.onSave).toHaveBeenCalledWith({ action: "deleteContact", id, expected }),
  );
  rerender(localized({ ...value, busy: true }));
  expect(screen.getByRole("button", { name: "Edit self@example.test" })).toHaveProperty(
    "disabled",
    true,
  );
});

it.each(["he", "en", "ru"] as const)(
  "displays a solo resident and roommates without changing their individual names in %s",
  async (lang) => {
    const value = props();
    value.data = {
      ...value.data!,
      name: "Dana",
      members: [{ id: "dana", name: "Dana Cohen", primary: true, contacts: [] }],
    };
    const { rerender } = render(localized(value, lang));
    expect(screen.getByText("Dana")).toBeTruthy();
    expect(screen.getByText("Dana Cohen")).toBeTruthy();
    expect(screen.getByText(translate(lang, "homeAdultsOnly"))).toBeTruthy();
    value.data = {
      ...value.data,
      name: "Apartment 12 roommates",
      members: [
        ...value.data.members,
        { id: "alex", name: "Alex Levi", primary: false, contacts: [] },
      ],
    };
    rerender(localized(value, lang));
    expect(screen.getByText("Apartment 12 roommates")).toBeTruthy();
    expect(screen.getByText("Alex Levi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "homeRename") }));
    fireEvent.change(screen.getByLabelText(translate(lang, "familyName")), {
      target: { value: "Our home" },
    });
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "save") }));
    await waitFor(() =>
      expect(value.onSave).toHaveBeenCalledWith({
        action: "rename",
        name: "Our home",
        expected: "Apartment 12 roommates",
      }),
    );
    expect(screen.getByText("Dana Cohen")).toBeTruthy();
    expect(screen.getByText("Alex Levi")).toBeTruthy();
  },
);

const savedEmail = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "email",
  value: "self@example.test",
  label: "Home",
  visibility: "project",
} as const;

it("edits one saved card in place and submits all fields with the original snapshot", async () => {
  const value = props();
  value.data!.ownContacts = [
    savedEmail,
    { ...savedEmail, id: "other", value: "second@example.test" },
  ];
  render(localized(value));

  const edit = screen.getByRole("button", { name: "Edit self@example.test" });
  const card = edit.closest(".rounded-xl") as HTMLElement;
  fireEvent.click(edit);

  const form = within(card);
  expect(form.getByLabelText(translate("en", "email"))).toHaveFocus();
  expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(form.getByLabelText(translate("en", "homeContactKind")), {
    target: { value: "phone" },
  });
  const phone = form.getByLabelText(translate("en", "phone"));
  expect(phone).toHaveAttribute("inputmode", "tel");
  fireEvent.change(phone, { target: { value: "0501234567" } });
  fireEvent.change(form.getByLabelText(translate("en", "homeContactLabel")), {
    target: { value: "Mobile" },
  });
  fireEvent.click(form.getByRole("radio", { name: translate("en", "vis_building") }));
  expect(screen.getByRole("button", { name: "Edit second@example.test" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add contact detail" })).toBeDisabled();

  fireEvent.click(form.getByRole("button", { name: "Save" }));
  const { id, ...expected } = savedEmail;
  await waitFor(() =>
    expect(value.onSave).toHaveBeenCalledExactlyOnceWith({
      action: "updateContact",
      id,
      expected,
      contact: { kind: "phone", value: "0501234567", label: "Mobile", visibility: "building" },
    }),
  );
  await waitFor(() =>
    expect(form.getByRole("button", { name: "Edit self@example.test" })).toHaveFocus(),
  );
});

it("keeps a failed draft inline, blocks stale resubmission, and restores focus on cancel", async () => {
  const value = props();
  value.data!.ownContacts = [savedEmail];
  value.onSave = vi.fn().mockResolvedValue(false);
  const { rerender } = render(localized(value));
  const edit = screen.getByRole("button", { name: "Edit self@example.test" });
  const card = edit.closest(".rounded-xl") as HTMLElement;
  fireEvent.click(edit);
  const form = within(card);
  const label = form.getByLabelText(translate("en", "homeContactLabel"));
  fireEvent.change(label, { target: { value: "Draft" } });
  fireEvent.click(form.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(value.onSave).toHaveBeenCalledTimes(1));

  rerender(localized({ ...value, error: "DUPLICATE_CONTACT" }));
  expect(form.getByRole("alert")).toHaveTextContent(translate("en", "homeDuplicate"));
  expect(label).toHaveValue("Draft");

  rerender(localized({ ...value, error: "STALE_HOUSEHOLD" }));
  expect(form.getByRole("alert")).toHaveTextContent(translate("en", "homeStale"));
  expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.click(form.getByRole("button", { name: translate("en", "refreshDirectory") }));
  expect(value.onRefresh).toHaveBeenCalledTimes(1);
  expect(value.onSave).toHaveBeenCalledTimes(1);

  value.data!.ownContacts = [{ ...savedEmail, label: "Updated elsewhere" }];
  rerender(localized(value));
  expect(form.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(label).toHaveValue("Draft");
  fireEvent.click(form.getByRole("button", { name: "Cancel" }));
  expect(form.getByText("Updated elsewhere")).toBeVisible();
  expect(form.getByRole("button", { name: "Edit self@example.test" })).toHaveFocus();
});

it("shows only authorized member actions and clears an owner draft when edit rights disappear", () => {
  const value = props();
  value.data!.ownContacts = [savedEmail];
  value.data!.members[0].contacts = [{ kind: "email", value: "public@example.test" }];
  const { rerender } = render(localized(value));
  expect(screen.getByRole("link", { name: translate("en", "mail") })).toHaveAttribute(
    "href",
    "mailto:public%40example.test",
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit self@example.test" }));
  expect(screen.getByDisplayValue("self@example.test")).toBeVisible();
  rerender(localized({ ...value, data: { ...value.data!, ownContacts: null } }));
  expect(screen.queryByDisplayValue("self@example.test")).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit self@example.test" })).toBeNull();
  rerender(localized(value));
  expect(screen.queryByDisplayValue("self@example.test")).toBeNull();
});
