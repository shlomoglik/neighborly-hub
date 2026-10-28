// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { FamilyWorkspace, type FamilyWorkspaceProps } from "./FamilyWorkspace";
vi.mock("@/features/invitations/InvitationShare", () => ({
  InvitationShare: ({ url }: { url: string }) => <div>{url}</div>,
}));
const childId = "00000000-0000-4000-8000-000000000002";
const props = (): FamilyWorkspaceProps => ({
  id: "home",
  status: "ready",
  busy: false,
  error: null,
  created: null,
  onRefresh: vi.fn(),
  onPage: vi.fn(),
  onInvitationPage: vi.fn(),
  onMutate: vi.fn().mockResolvedValue(true),
  onInvite: vi.fn().mockResolvedValue(true),
  onRenew: async () => true,
  onRevoke: vi.fn().mockResolvedValue(true),
  data: {
    family: {
      id: "home",
      name: "Family",
      projectName: "Project",
      page: 1,
      hasNext: false,
      canAdd: true,
      members: [
        {
          id: "adult",
          name: "Adult",
          relation: null,
          child: false,
          representative: true,
          editable: false,
        },
        {
          id: childId,
          name: "PRIVATE CHILD",
          relation: "Daughter",
          child: true,
          representative: false,
          editable: true,
        },
      ],
    },
    invitations: { invitations: [], page: 1, hasNext: false, canInviteStaff: false },
  },
});
function localized(value: FamilyWorkspaceProps, lang: Lang = "en") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <FamilyWorkspace {...value} />
    </I18nContext.Provider>
  );
}
beforeEach(() =>
  vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" }),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each(["he", "en", "ru"] as const)(
  "localizes private family controls and does not offer adult edits in %s",
  (lang) => {
    render(localized(props(), lang));
    expect(screen.getByText("PRIVATE CHILD")).toBeTruthy();
    expect(screen.getByText(translate(lang, "familyPrivateHint"))).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: translate(lang, "familyEditChild", { name: "PRIVATE CHILD" }),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: translate(lang, "familyEditChild", { name: "Adult" }) }),
    ).toBeNull();
  },
);
it("keeps child creation request IDs stable across a failed retry without accepting an adult/person identity", async () => {
  const value = props();
  vi.mocked(value.onMutate).mockResolvedValue(false);
  render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Add a child" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Noa" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(value.onMutate).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(value.onMutate).toHaveBeenCalledTimes(2));
  const expected = {
    action: "addChild",
    requestId: "00000000-0000-4000-8000-000000000001",
    profile: { name: "Noa", relation: null },
  };
  expect(value.onMutate).toHaveBeenNthCalledWith(1, expected);
  expect(value.onMutate).toHaveBeenNthCalledWith(2, expected);
});
it("submits expected child details for stale-write protection and confirms removal", async () => {
  const value = props();
  render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Edit PRIVATE CHILD" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New child name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(value.onMutate).toHaveBeenCalledWith({
      action: "updateChild",
      id: childId,
      profile: { name: "New child name", relation: "Daughter" },
      expected: { name: "PRIVATE CHILD", relation: "Daughter" },
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove PRIVATE CHILD" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  expect(value.onMutate).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(value.onMutate).toHaveBeenLastCalledWith({
      action: "removeChild",
      id: childId,
      expected: { name: "PRIVATE CHILD", relation: "Daughter" },
    }),
  );
});
it("issues a household-bound adult invitation with optional recipient restriction", async () => {
  const value = props();
  render(localized(value));
  fireEvent.change(screen.getByLabelText(translate("en", "inviteRecipientEmail")), {
    target: { value: "adult@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create invitation" }));
  await waitFor(() =>
    expect(value.onInvite).toHaveBeenCalledWith({
      recipientEmail: "adult@example.test",
      expiresInDays: 7,
    }),
  );
});
it("hides child names, drafts and secret URLs throughout loading and access loss", () => {
  const value = props();
  value.created = { id: "invite", url: "https://app.test/join/secret", email: "" };
  const { rerender } = render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Edit PRIVATE CHILD" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "PRIVATE DRAFT" } });
  rerender(localized({ ...value, status: "loading" }));
  expect(screen.queryByText("PRIVATE CHILD")).toBeNull();
  expect(screen.queryByText(value.created.url)).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Full name" })).toBeNull();
  rerender(localized(value));
  expect(screen.getByLabelText("Full name")).toHaveProperty("value", "PRIVATE DRAFT");
  rerender(localized({ ...value, status: "unavailable", data: null }));
  rerender(localized({ ...value, created: null }));
  expect(screen.queryByLabelText("Full name")).toBeNull();
});
it("disables profile and invitation creation at the member limit and during writes", () => {
  const value = props();
  value.data!.family.canAdd = false;
  const { rerender } = render(localized(value));
  expect(screen.getByRole("button", { name: "Add a child" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Create invitation" })).toHaveProperty(
    "disabled",
    true,
  );
  rerender(localized({ ...value, busy: true }));
  expect(screen.getByRole("button", { name: "Edit PRIVATE CHILD" })).toHaveProperty(
    "disabled",
    true,
  );
});
