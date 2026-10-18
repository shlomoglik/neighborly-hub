// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { ManagementWorkspace, type ManagementWorkspaceProps } from "./ManagementWorkspace";
afterEach(cleanup);
function mount(lang: Lang = "en", overrides: Partial<ManagementWorkspaceProps> = {}) {
  const props: ManagementWorkspaceProps = {
    status: "ready",
    selectedProjectId: "p",
    buildingId: "",
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
        { id: "a", name: "Empty building", floors: [] },
        {
          id: "b",
          name: "Building",
          floors: [
            { id: "f", number: 0, apartments: [] },
            { id: "g", number: 1, apartments: [{ id: "u", number: "2" }] },
          ],
        },
      ],
      canAddBuilding: false,
      counts: { buildings: 2, floors: 2, apartments: 1 },
    },
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
  "renders saved structure, scoped counts, neutral apartments and empty floors in %s",
  (lang) => {
    const props = mount(lang);
    expect(screen.getByText(translate(lang, "managementCounts", props.data!.counts))).toBeTruthy();
    expect(screen.getByText(translate(lang, "managementNoFloors"))).toBeTruthy();
    expect(screen.getByText(translate(lang, "managementNoApartments"))).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText(translate(lang, "vacant"))).toBeNull();
    expect(screen.queryByText(translate(lang, "noPending"))).toBeNull();
    expect(screen.queryByRole("link", { name: translate(lang, "newProject") })).toBeNull();
    const link = screen.getByRole("link", { name: /Saved project/ });
    expect(link.getAttribute("href")).toBe("/manage?project=p");
    expect(link.getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("radio", { name: "Building" }));
    expect(props.onBuildingChange).toHaveBeenCalledWith("b");
  },
);
it("shows the creation link exclusively for the server capability", () => {
  mount("en", {
    discovery: {
      projects: [],
      page: 1,
      hasNext: false,
      canCreateProject: true,
      hasManagementAccess: true,
    },
    status: "empty",
    data: null,
  });
  expect(
    screen.getByRole("link", { name: translate("en", "newProject") }).getAttribute("href"),
  ).toBe("/manage/setup");
});
it.each(["he", "en", "ru"] as const)("localizes all asynchronous states in %s", (lang) => {
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
    if (["error", "forbidden", "unavailable"].includes(status)) {
      fireEvent.click(screen.getByRole("button", { name: translate(lang, "retry") }));
      expect(p.onRefresh).toHaveBeenCalledOnce();
    }
    if (status === "expired")
      expect(
        screen.getByRole("link", { name: translate(lang, "signIn") }).getAttribute("href"),
      ).toBe("/auth");
    cleanup();
  }
});
it("renders an empty saved project and provides explicit discovery pagination", () => {
  const p = mount("en", {
    data: {
      id: "p",
      name: "Empty project",
      city: null,
      buildings: [],
      canAddBuilding: false,
      counts: { buildings: 0, floors: 0, apartments: 0 },
    },
    discovery: {
      projects: [],
      page: 2,
      hasNext: true,
      canCreateProject: false,
      hasManagementAccess: true,
    },
  });
  expect(screen.getByText(translate("en", "managementNoBuildings"))).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: translate("en", "directoryNext") }));
  expect(p.onPageChange).toHaveBeenCalledWith(3);
});

it("restores keyboard focus after building loads and refresh", () => {
  const p = mount();
  fireEvent.click(screen.getByRole("radio", { name: "Building" }));
  p.update({ status: "loading", data: null, discovery: null, buildingId: "b" });
  p.update({ status: "ready", buildingId: "b" });
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Building" }));
  fireEvent.click(screen.getByRole("button", { name: translate("en", "refreshManagement") }));
  p.update({ status: "loading", data: null, discovery: null });
  p.update({ status: "ready" });
  expect(document.activeElement).toBe(
    screen.getByRole("heading", { name: translate("en", "manage") }),
  );
});

it("shows staff management only for the server-derived global administrator capability", () => {
  const p = mount();
  expect(screen.queryByRole("link", { name: translate("en", "staffManagement") })).toBeNull();
  p.update({ discovery: { ...p.discovery!, canCreateProject: true } });
  expect(
    screen.getByRole("link", { name: translate("en", "staffManagement") }).getAttribute("href"),
  ).toBe("/manage/staff/p");
});

it("provides scoped structure actions using stable parent IDs and current expected labels", () => {
  const onEdit = vi.fn();
  const p = mount("en", { onEdit });
  expect(screen.queryByRole("button", { name: translate("en", "addBuilding") })).toBeNull();
  fireEvent.click(
    screen.getAllByRole("button", { name: translate("en", "structureRenameBuilding") })[0],
  );
  expect(onEdit).toHaveBeenLastCalledWith({
    mode: "update",
    entity: "building",
    id: "a",
    expected: "Empty building",
  });
  fireEvent.click(screen.getAllByRole("button", { name: translate("en", "structureAddFloor") })[0]);
  expect(onEdit).toHaveBeenLastCalledWith({ mode: "create", entity: "floor", buildingId: "a" });
  fireEvent.click(
    screen.getByRole("button", {
      name: translate("en", "structureEditApartmentLabel", { n: "2", building: "Building" }),
    }),
  );
  expect(onEdit).toHaveBeenLastCalledWith({
    mode: "update",
    entity: "apartment",
    id: "u",
    expected: "2",
  });
  p.update({ onEdit, data: { ...p.data!, canAddBuilding: true } });
  fireEvent.click(screen.getByRole("button", { name: translate("en", "addBuilding") }));
  expect(onEdit).toHaveBeenLastCalledWith({ mode: "create", entity: "building" });
});
