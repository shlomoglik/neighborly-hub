// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import type { DraftBuilding } from "./project-structure-draft";

afterEach(cleanup);

const buildings: DraftBuilding[] = [
  {
    id: "b1",
    name: "Building Alon - B1",
    address: "5 Eli Cohen",
    floors: [
      {
        id: "f8",
        number: 8,
        name: "Floor 8",
        type: "residential",
        apartments: [
          { id: "u1", number: "801", type: "residential", linked: true },
          { id: "u2", number: "Shop", type: "commercial" },
        ],
      },
      { id: "f0", number: 0, name: "Lobby", type: "commercial", apartments: [] },
    ],
  },
];

function mount(lang: Lang, mode: "view" | "edit" = "view") {
  return render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <ProjectStructureEditor
        mode={mode}
        buildings={buildings}
        onChange={vi.fn()}
        projectName="Project"
      />
    </I18nContext.Provider>,
  );
}

it.each(["he", "en", "ru"] as const)("renders the compact read-only map in %s", (lang) => {
  mount(lang);
  expect(screen.getByRole("heading", { name: "Building Alon - B1" }).className).toContain(
    "font-heading",
  );
  expect(screen.getByText("5 Eli Cohen")).toBeTruthy();
  expect(screen.queryByText("#1")).toBeNull();
  expect(screen.getAllByText(translate(lang, "commercial")).length).toBeGreaterThan(0);
  expect(screen.getByLabelText(translate(lang, "editorLinked"))).toBeTruthy();
  expect(screen.queryByText(translate(lang, "editorHint"))).toBeNull();
  const accordion = screen.getByRole("button", {
    name: `${translate(lang, "editorCollapse")} Building Alon - B1`,
  });
  fireEvent.click(accordion);
  expect(accordion.getAttribute("aria-expanded")).toBe("false");
  expect(accordion.closest("article")?.querySelector(".hidden")).toBeTruthy();
});

it("preserves editor-only structure controls in edit mode", () => {
  mount("en", "edit");
  expect(screen.getByText("#1")).toBeTruthy();
  expect(screen.getByText(translate("en", "editorHint"))).toBeTruthy();
  expect(screen.getAllByLabelText(/Unit type/).length).toBeGreaterThan(0);
  expect(
    screen.getAllByRole("button", { name: /Duplicate floor/ })[0].querySelector(".lucide-copy"),
  ).toBeTruthy();
  const collapse = screen.getByRole("button", { name: translate("en", "editorCollapse") });
  expect(collapse.querySelector(".lucide-chevrons-down-up")).toBeTruthy();
  fireEvent.click(collapse);
  expect(
    screen
      .getByRole("button", { name: translate("en", "editorExpand") })
      .querySelector(".lucide-chevrons-up-down"),
  ).toBeTruthy();
});

it("shows a floor parking label only when every unit is parking", () => {
  const parkingFloors: DraftBuilding[] = [
    {
      ...buildings[0],
      floors: [
        {
          id: "mixed",
          number: 1,
          name: "Mixed floor",
          type: "parking",
          apartments: [
            { id: "home", number: "1", type: "residential" },
            { id: "space", number: "P1", type: "parking" },
          ],
        },
        {
          id: "parking",
          number: 0,
          name: "Parking floor",
          type: "parking",
          apartments: [{ id: "space-2", number: "P2", type: "parking" }],
        },
      ],
    },
  ];
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <ProjectStructureEditor
        mode="view"
        buildings={parkingFloors}
        onChange={vi.fn()}
        projectName="Project"
      />
    </I18nContext.Provider>,
  );

  expect(
    within(screen.getByRole("heading", { name: "Mixed floor" }).closest("section")!).queryByText(
      "Parking",
    ),
  ).toBeNull();
  expect(
    within(screen.getByRole("heading", { name: "Parking floor" }).closest("section")!).getByText(
      "Parking",
    ),
  ).toBeTruthy();
});
