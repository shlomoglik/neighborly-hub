// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { ManageProjectHeader, type ManageProjectTab } from "./ManageProjectHeader";

afterEach(cleanup);

function mount(lang: Lang, active: ManageProjectTab, canManageStaff = true) {
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
      />
    </I18nContext.Provider>,
  );
}

it.each(["he", "en", "ru"] as const)("marks the active management tab in %s", (lang) => {
  mount(lang, "invitations");
  const tabs = screen.getByRole("navigation", { name: translate(lang, "managementSections") });
  expect(within(tabs).getByRole("link", { name: /2/ }).getAttribute("aria-current")).toBe("page");
  expect(
    screen.queryByRole("button", { name: translate(lang, "managementEditStructure") }),
  ).toBeNull();
});

it.each(["structure", "staff", "invitations"] as const)(
  "keeps the shared %s header free of structure actions",
  (active) => {
    mount("en", active);
    expect(screen.queryByRole("button")).toBeNull();
  },
);

it("hides inaccessible staff navigation and displays project counts", () => {
  mount("en", "structure", false);
  expect(screen.queryByRole("link", { name: "Manage staff" })).toBeNull();
  expect(screen.getByRole("status").textContent).toBe(
    "Sderot · 4 buildings · 36 floors · 116 apartments",
  );
});
