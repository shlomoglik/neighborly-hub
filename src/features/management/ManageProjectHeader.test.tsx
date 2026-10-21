// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { ManageProjectHeader, type ManageProjectTab } from "./ManageProjectHeader";

afterEach(cleanup);

function mount(lang: Lang, active: ManageProjectTab, canManageStaff = true, editing = false) {
  const onEdit = vi.fn();
  render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <ManageProjectHeader
        project={{
          id: "project",
          name: "Project",
          city: "Sderot",
          counts: { buildings: 4, floors: 36, apartments: 116 },
        }}
        active={active}
        canManageStaff={canManageStaff}
        pendingCount={2}
        editing={editing}
        onEdit={active === "structure" ? onEdit : undefined}
      />
    </I18nContext.Provider>,
  );
  return onEdit;
}

it.each(["he", "en", "ru"] as const)("marks the active management tab in %s", (lang) => {
  mount(lang, "invitations");
  const tabs = screen.getByRole("navigation", { name: translate(lang, "managementSections") });
  expect(within(tabs).getByRole("link", { name: /2/ }).getAttribute("aria-current")).toBe("page");
  expect(
    screen.queryByRole("button", { name: translate(lang, "managementEditStructure") }),
  ).toBeNull();
});

it("uses pencil for edit and eye for returning to the structure view", () => {
  mount("en", "structure");
  expect(
    screen.getByRole("button", { name: "Edit structure" }).querySelector(".lucide-pencil"),
  ).toBeTruthy();
  cleanup();
  mount("en", "structure", true, true);
  expect(
    screen
      .getByRole("button", { name: translate("en", "managementViewStructure") })
      .querySelector(".lucide-eye"),
  ).toBeTruthy();
});

it("shows the edit action only on structure and hides inaccessible staff navigation", () => {
  const onEdit = mount("en", "structure", false);
  fireEvent.click(screen.getByRole("button", { name: "Edit structure" }));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(screen.queryByRole("link", { name: "Manage staff" })).toBeNull();
  expect(screen.getByRole("status").textContent).toBe(
    "Sderot · 4 buildings · 36 floors · 116 apartments",
  );
});
