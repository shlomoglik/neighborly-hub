// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { InvitationWorkspace, type InvitationWorkspaceProps } from "./InvitationWorkspace";
import { JoinInvitation, type JoinInvitationProps } from "./JoinInvitation";
import { InvitationShare } from "./InvitationShare";
afterEach(cleanup);
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
const apartmentId = "94864538-67d1-4f89-8ea5-3b4a707e9a32";
function localized(node: React.ReactNode, lang: Lang = "en") {
  return render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      {node}
    </I18nContext.Provider>,
  );
}
function workspace(overrides: Partial<InvitationWorkspaceProps> = {}, lang: Lang = "en") {
  const props: InvitationWorkspaceProps = {
    projectId,
    status: "ready",
    busy: false,
    error: null,
    created: null,
    data: {
      hierarchy: {
        id: projectId,
        name: "Saved project",
        city: null,
        canAddBuilding: false,
        counts: { buildings: 1, floors: 1, apartments: 1 },
        buildings: [
          {
            id: buildingId,
            name: "Scoped building",
            floors: [{ id: "f", number: 0, apartments: [{ id: apartmentId, number: "2" }] }],
          },
        ],
      },
      invitations: { invitations: [], canInviteStaff: false, page: 1, hasNext: false },
      requests: { requests: [], page: 1, hasNext: false },
    },
    onCreate: vi.fn().mockResolvedValue(true),
    onRevoke: vi.fn(),
    onReview: vi.fn(),
    onRefresh: vi.fn(),
    onInvitationPage: vi.fn(),
    onRequestPage: vi.fn(),
    ...overrides,
  };
  localized(<InvitationWorkspace {...props} />, lang);
  return props;
}
it.each(["he", "en", "ru"] as const)(
  "localizes manager scope and submits exact invitation scope in %s",
  async (lang) => {
    const p = workspace({}, lang);
    expect(screen.queryByRole("option", { name: translate(lang, "project_manager") })).toBeNull();
    expect(screen.queryByRole("option", { name: translate(lang, "building_manager") })).toBeNull();
    fireEvent.change(screen.getByLabelText(translate(lang, "building")), {
      target: { value: buildingId },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: translate(lang, "inviteCreate") }).closest("form")!,
    );
    await waitFor(() =>
      expect(p.onCreate).toHaveBeenCalledWith({
        kind: "resident",
        buildingId,
        apartmentId: null,
        expiresInDays: 7,
      }),
    );
    expect(screen.getByText(translate(lang, "inviteNoRequests"))).toBeTruthy();
  },
);
it("shows staff invitations only with server capability", () => {
  const p = workspace();
  cleanup();
  workspace({
    data: { ...p.data!, invitations: { ...p.data!.invitations, canInviteStaff: true } },
  });
  expect(screen.getByRole("option", { name: translate("en", "project_manager") })).toBeTruthy();
});
it.each(["loading", "error", "unavailable", "expired"] as const)(
  "hides previous hierarchy, links and requests in %s state",
  (status) => {
    workspace({ status });
    expect(screen.queryByText("Saved project")).toBeNull();
    expect(screen.queryByRole("button", { name: translate("en", "inviteCreate") })).toBeNull();
    if (status === "expired")
      expect(
        screen.getByRole("link", { name: translate("en", "signIn") }).getAttribute("href"),
      ).toBe("/auth");
  },
);
function join(overrides: Partial<JoinInvitationProps> = {}, lang: Lang = "en") {
  const props: JoinInvitationProps = {
    status: "ready",
    busy: false,
    error: null,
    data: {
      projectName: "Saved project",
      buildingName: "Scoped building",
      fixedApartmentId: apartmentId,
      kind: "resident",
      apartments: [{ id: apartmentId, number: "2", floor: 0 }],
      page: 1,
      hasNext: false,
      request: null,
      active: true,
    },
    onSubmit: vi.fn(),
    onRefresh: vi.fn(),
    onPage: vi.fn(),
    ...overrides,
  };
  localized(<JoinInvitation {...props} />, lang);
  return props;
}
it.each(["he", "en", "ru"] as const)(
  "requests membership without granting it optimistically in %s",
  async (lang) => {
    const p = join({}, lang);
    fireEvent.change(screen.getByLabelText(translate(lang, "fullName")), {
      target: { value: "New name" },
    });
    fireEvent.change(screen.getByLabelText(translate(lang, "familyName")), {
      target: { value: "New home" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: translate(lang, "inviteSubmit") }).closest("form")!,
    );
    await waitFor(() =>
      expect(p.onSubmit).toHaveBeenCalledWith({
        apartmentId,
        fullName: "New name",
        householdName: "New home",
      }),
    );
    expect(screen.queryByText(translate(lang, "inviteApproved"))).toBeNull();
  },
);
it("shows saved pending status and never offers duplicate submission", () => {
  const p = join();
  cleanup();
  join({ data: { ...p.data!, request: { id: "r", status: "pending" } } });
  expect(screen.getByRole("status").textContent).toBe(translate("en", "invitePending"));
  expect(screen.queryByRole("button", { name: translate("en", "inviteSubmit") })).toBeNull();
});
it("creates a local printable/downloadable QR and targeted WhatsApp/mailto links", async () => {
  const url = `https://example.test/join/${"a".repeat(64)}`;
  localized(<InvitationShare url={url} projectName="Saved project" email="target@example.test" />);
  await waitFor(() =>
    expect(screen.getByRole("img").getAttribute("src")).toContain("data:image/svg+xml"),
  );
  fireEvent.change(screen.getByLabelText(translate("en", "invitePhone")), {
    target: { value: "0501234567" },
  });
  expect(
    screen.getByRole("link", { name: translate("en", "inviteSendPhone") }).getAttribute("href"),
  ).toContain("https://wa.me/972501234567?text=");
  expect(
    screen.getByRole("link", { name: translate("en", "inviteEmail") }).getAttribute("href"),
  ).toContain("mailto:target%40example.test?subject=");
  expect(
    screen
      .getByRole("link", { name: translate("en", "inviteDownloadQr") })
      .getAttribute("download"),
  ).toBe("neighborly-invitation.svg");
  expect(screen.getByRole("button", { name: translate("en", "invitePrint") })).toBeTruthy();
});
