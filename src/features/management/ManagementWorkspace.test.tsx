// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { ManagementWorkspace, type ManagementWorkspaceProps } from "./ManagementWorkspace";
afterEach(cleanup);
function mount(lang: Lang = "en", overrides: Partial<ManagementWorkspaceProps> = {}) {
  const props: ManagementWorkspaceProps = {
    status: "ready",
    mode: "edit",
    selectedProjectId: "p",
    buildingIds: [],
    discovery: {
      projects: [{ id: "p", name: "Saved project", city: "Sderot" }],
      page: 1,
      hasNext: false,
      canCreateProject: false,
      hasManagementAccess: true,
    },
    data: {
      id: "p",
      name: "Saved project",
      city: "Sderot",
      buildings: [
        { id: "a", name: "Building A", floors: [] },
        { id: "b", name: "Building B", floors: [] },
      ],
      canAddBuilding: false,
      counts: { buildings: 2, floors: 0, apartments: 0 },
    },
    structure: <div data-testid="shared-editor">Shared structure editor</div>,
    onBuildingChange: vi.fn(),
    onPageChange: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
  const view = (value: ManagementWorkspaceProps) => (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <ManagementWorkspace {...value} />
    </I18nContext.Provider>
  );
  const rendered = render(view(props));
  return {
    ...props,
    update: (changes: Partial<ManagementWorkspaceProps>) =>
      rendered.rerender(view({ ...props, ...changes })),
  };
}
it.each(["he", "en", "ru"] as const)(
  "navigates from project cards to a dedicated page in %s",
  (lang) => {
    mount(lang, { selectedProjectId: "", data: null, structure: null });
    const link = screen.getByRole("link", { name: /Saved project/ });
    expect(link.getAttribute("href")).toBe("/manage/project/p");
    expect(
      screen.queryByRole("navigation", { name: translate(lang, "managementBreadcrumb") }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: translate(lang, "directoryNext") })).toBeNull();
  },
);
it.each(["he", "en", "ru"] as const)(
  "uses breadcrumbs and the shared editor on project pages in %s",
  (lang) => {
    const p = mount(lang);
    const breadcrumb = screen.getByRole("navigation", {
      name: translate(lang, "managementBreadcrumb"),
    });
    expect(
      within(breadcrumb)
        .getByRole("link", { name: translate(lang, "manage") })
        .getAttribute("href"),
    ).toBe("/manage");
    expect(
      within(breadcrumb).getByText("Saved project").getAttribute("aria-current") ??
        within(breadcrumb).getByText("Saved project").parentElement?.getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("navigation", { name: translate(lang, "chooseProject") })).toBeNull();
    expect(screen.getByTestId("shared-editor")).toBeTruthy();
    expect(screen.getByText(translate(lang, "managementCounts", p.data!.counts))).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Building B" }));
    expect(p.onBuildingChange).toHaveBeenCalledWith(["b"]);
    expect(
      screen.queryByRole("button", { name: translate(lang, "structureRenameBuilding") }),
    ).toBeNull();
  },
);
it("retains explicit discovery pagination and admin-only creation", () => {
  const p = mount("en", {
    selectedProjectId: "",
    data: null,
    structure: null,
    discovery: {
      projects: [],
      page: 2,
      hasNext: true,
      canCreateProject: true,
      hasManagementAccess: true,
    },
  });
  expect(screen.getByRole("link", { name: "New project" }).getAttribute("href")).toBe(
    "/manage/setup",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(p.onPageChange).toHaveBeenCalledWith(3);
});
it.each(["he", "en", "ru"] as const)(
  "localizes failures and hides structure when access is unavailable in %s",
  (lang) => {
    for (const [status, key] of [
      ["empty", "managementEmpty"],
      ["forbidden", "managementForbidden"],
      ["unavailable", "managementUnavailable"],
      ["expired", "managementExpired"],
      ["error", "loadError"],
      ["loading", "loading"],
    ] as const) {
      const p = mount(lang, { status, discovery: null, data: null });
      expect(screen.getByText(translate(lang, key))).toBeTruthy();
      if (status !== "loading") expect(screen.queryByTestId("shared-editor")).toBeNull();
      if (["error", "forbidden", "unavailable"].includes(status)) {
        fireEvent.click(screen.getByRole("button", { name: translate(lang, "retry") }));
        expect(p.onRefresh).toHaveBeenCalledOnce();
      }
      cleanup();
    }
  },
);
it("keeps empty projects and scoped building creation available", () => {
  const onEdit = vi.fn();
  const p = mount("en", {
    data: {
      id: "p",
      name: "Empty project",
      city: null,
      buildings: [],
      canAddBuilding: false,
      counts: { buildings: 0, floors: 0, apartments: 0 },
    },
    onEdit,
  });
  expect(screen.getByText(translate("en", "managementNoBuildings"))).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add building" })).toBeNull();
  p.update({ data: { ...p.data!, canAddBuilding: true } });
  fireEvent.click(screen.getByRole("button", { name: "Add building" }));
  expect(onEdit).toHaveBeenCalledWith({ mode: "create", entity: "building" });
});
it("uses server capabilities for staff links and disables building switches while saving", () => {
  const p = mount();
  expect(screen.queryByRole("link", { name: translate("en", "staffManagement") })).toBeNull();
  p.update({ discovery: { ...p.discovery!, canCreateProject: true }, editingBusy: true });
  expect(
    screen.getByRole("link", { name: translate("en", "staffManagement") }).getAttribute("href"),
  ).toBe("/manage/staff/p");
  expect(
    screen
      .getByRole("checkbox", { name: "Building B" })
      .closest("fieldset")
      ?.hasAttribute("disabled"),
  ).toBe(true);
});
it("restores heading focus after an explicit refresh", () => {
  const p = mount();
  fireEvent.click(screen.getByRole("button", { name: translate("en", "refreshManagement") }));
  p.update({ status: "loading", data: null });
  p.update({ status: "ready" });
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Saved project" }));
});
it("supports multiple building chips and an explicit all-buildings reset", () => {
  const p = mount("en", { buildingIds: ["a"] });
  fireEvent.click(screen.getByRole("checkbox", { name: "Building B" }));
  expect(p.onBuildingChange).toHaveBeenLastCalledWith(["a", "b"]);
  p.update({ buildingIds: ["a", "b"] });
  fireEvent.click(screen.getByRole("checkbox", { name: "Building A" }));
  expect(p.onBuildingChange).toHaveBeenLastCalledWith(["b"]);
  p.update({ buildingIds: ["b"] });
  fireEvent.click(screen.getByRole("checkbox", { name: "All buildings" }));
  expect(p.onBuildingChange).toHaveBeenLastCalledWith([]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Building B" }));
  expect(p.onBuildingChange).toHaveBeenLastCalledWith([]);
});
it.each(["he", "en", "ru"] as const)(
  "exposes localized view/edit transitions and creation only in edit mode in %s",
  (lang) => {
    const onModeChange = vi.fn();
    const onEdit = vi.fn();
    const p = mount(lang, {
      mode: "view",
      onModeChange,
      onEdit,
      data: {
        id: "p",
        name: "Project",
        city: null,
        buildings: [],
        canAddBuilding: true,
        counts: { buildings: 0, floors: 0, apartments: 0 },
      },
    });
    expect(screen.queryByRole("button", { name: translate(lang, "addBuilding") })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: translate(lang, "managementEditStructure") }),
    );
    expect(onModeChange).toHaveBeenLastCalledWith("edit");
    p.update({ mode: "edit" });
    expect(screen.getByRole("button", { name: translate(lang, "addBuilding") })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: translate(lang, "managementViewStructure") }),
    );
    expect(onModeChange).toHaveBeenLastCalledWith("view");
  },
);
