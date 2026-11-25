// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    ownPersonId: "adult",
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
    expect(screen.getByRole("link", { name: translate(lang, "homeEditContacts") })).toHaveAttribute(
      "href",
      "/household/home/contacts/edit",
    );
  },
);
it("hides editors for directory viewers and discards stale data during loading/denial", () => {
  const value = props();
  value.data = { ...value.data!, canRename: false, ownContacts: null };
  const { rerender } = render(localized(value));
  expect(screen.queryByRole("button", { name: "Edit household name" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Edit contact details" })).toBeNull();
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

it("places one edit link on the owner's card and preserves the full email target", () => {
  const value = props();
  const email = "a.very.long.contact.address.for.this.example@neighborhood.example.test";
  value.data!.ownContacts = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      kind: "email",
      value: email,
      label: null,
      visibility: "project",
    },
  ];
  value.data!.members.push({
    id: "neighbor",
    name: "Neighbor",
    primary: false,
    contacts: [{ kind: "email", value: "neighbor@example.test" }],
  });
  const { rerender } = render(localized(value));
  const edit = screen.getByRole("link", { name: "Edit contact details" });
  const card = edit.closest("article");
  expect(card).toHaveTextContent("Adult");
  expect(card).toHaveTextContent(email);
  expect(screen.getByRole("button", { name: email })).toHaveClass("truncate");
  expect(screen.getAllByRole("link", { name: translate("en", "mail") })[0]).toHaveAttribute(
    "href",
    `mailto:${encodeURIComponent(email)}`,
  );
  rerender(localized({ ...value, data: { ...value.data!, ownContacts: null, ownPersonId: null } }));
  expect(screen.queryByRole("link", { name: "Edit contact details" })).toBeNull();
  expect(screen.queryByText(email)).toBeNull();
});
