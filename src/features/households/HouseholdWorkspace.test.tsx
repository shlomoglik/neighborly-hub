// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
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
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
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
