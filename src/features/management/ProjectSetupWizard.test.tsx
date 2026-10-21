// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { ProjectSetupWizard, SETUP_DRAFT_KEY } from "./ProjectSetupWizard";
import { ProjectSetupRequestError } from "./project-setup-api";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import type { ProjectSetupResult } from "@/lib/db/project-setup-input";
import type { PublicErrorReason } from "@/lib/error-diagnostics";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
  vi.restoreAllMocks();
});
const result = { projectId: "c44c9aec-f8e4-46b3-9957-12ceba088994" };
function mount(
  onCreate: NonNullable<Parameters<typeof ProjectSetupWizard>[0]["onCreate"]>,
  lang: Lang = "en",
) {
  return render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <ProjectSetupWizard onCreate={onCreate} />
    </I18nContext.Provider>,
  );
}
function next(lang: Lang = "en") {
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "editorNext") }));
}
function fill(lang: Lang = "en") {
  fireEvent.change(screen.getByLabelText(translate(lang, "projectName")), {
    target: { value: " Community " },
  });
  fireEvent.change(screen.getByLabelText(translate(lang, "city")), {
    target: { value: " Sderot " },
  });
  next(lang);
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "building") }));
  fireEvent.change(screen.getByRole("textbox", { name: translate(lang, "building") }), {
    target: { value: "A" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: translate(lang, "building") }), {
    key: "Enter",
  });
  fireEvent.click(screen.getByRole("button", { name: `${translate(lang, "editorAddUnit")} A 0` }));
}
function review(lang: Lang = "en") {
  fill(lang);
  next(lang);
  next(lang);
}
it.each(["he", "en", "ru"] as const)("creates detailed structure in %s", async (lang) => {
  const create = vi.fn().mockResolvedValue(result);
  mount(create, lang);
  review(lang);
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "create") }));
  await screen.findByRole("heading", { name: translate(lang, "setupCreated") });
  expect(create).toHaveBeenCalledExactlyOnceWith({
    name: "Community",
    city: "Sderot",
    buildings: [
      {
        name: "A",
        floors: 1,
        unitsPerFloor: 1,
        structure: [
          {
            number: 0,
            name: `${translate(lang, "floor")} 0`,
            type: "residential",
            apartments: [{ number: "1", type: "residential" }],
          },
        ],
      },
    ],
  });
  expect(
    screen
      .getByRole("link", { name: translate(lang, "openProjectManagement") })
      .getAttribute("href"),
  ).toBe(`/manage/project/${result.projectId}`);
});
it.each(["he", "en", "ru"] as const)(
  "saves and submits visible default names without editing them in %s",
  async (lang) => {
    const create = vi.fn().mockResolvedValue(result);
    mount(create, lang);
    fireEvent.change(screen.getByLabelText(translate(lang, "projectName")), {
      target: { value: "Community" },
    });
    fireEvent.change(screen.getByLabelText(translate(lang, "city")), {
      target: { value: "Sderot" },
    });
    next(lang);
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "addBuilding") }));
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "editorSaveDraft") }));
    const saved = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!);
    expect(saved.buildings.map((b: { name: string }) => b.name)).toEqual([
      `${translate(lang, "building")} 1`,
      `${translate(lang, "building")} 2`,
    ]);
    const floorLabel = `${translate(lang, "floor")} 0`;
    expect(saved.buildings[0].floors[0].name).toBe(floorLabel);
    const floorName = `${translate(lang, "editorFloorName")} ${saved.buildings[0].name} 0`;
    fireEvent.click(screen.getByRole("button", { name: floorName }));
    expect((screen.getByRole("textbox", { name: floorName }) as HTMLInputElement).value).toBe(
      floorLabel,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: floorName }), { key: "Enter" });
    next(lang);
    next(lang);
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "create") }));
    await screen.findByRole("heading", { name: translate(lang, "setupCreated") });
    expect(create.mock.calls[0][0].buildings[0]).toMatchObject({
      name: `${translate(lang, "building")} 1`,
      structure: [{ number: 0, name: floorLabel }],
    });
  },
);
it("restores older drafts with actual defaults for missing building and floor names", () => {
  localStorage.setItem(
    SETUP_DRAFT_KEY,
    JSON.stringify({
      version: 2,
      revision: "old-draft",
      name: "Community",
      city: "Sderot",
      step: 1,
      buildings: [
        {
          id: "b",
          name: "",
          address: "Example street 5",
          floors: [{ id: "f", number: 0, name: "", type: "parking", apartments: [] }],
        },
      ],
    }),
  );
  mount(vi.fn());
  fireEvent.click(screen.getByRole("button", { name: "Restore saved draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  const saved = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!);
  expect(saved.buildings[0]).toMatchObject({
    id: "b",
    name: "Building 1",
    address: "Example street 5",
    floors: [{ id: "f", number: 0, name: "Floor 0", type: "parking" }],
  });
  expect(
    screen.getByRole("button", { name: "Continue to next step" }).hasAttribute("disabled"),
  ).toBe(false);
});
it("prevents duplicate submit and navigation during save", async () => {
  let finish!: (value: ProjectSetupResult) => void;
  const create = vi.fn(
    () =>
      new Promise<ProjectSetupResult>((resolve) => {
        finish = resolve;
      }),
  );
  mount(create);
  review();
  const submit = screen.getByRole("button", { name: "Create" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(create).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
  finish(result);
  await screen.findByRole("heading", { name: "Project created" });
});
it.each([
  [401, "setupExpired"],
  [403, "setupForbidden"],
  [400, "setupInvalid"],
  [500, "setupFailed"],
] as const)("retains values after HTTP %s", async (status, key) => {
  const create = vi.fn().mockRejectedValue(new ProjectSetupRequestError(status));
  mount(create);
  review();
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(translate("en", key)),
  );
  expect(screen.queryByRole("heading", { name: "Project created" })).toBeNull();
  expect(create).toHaveBeenCalledOnce();
});
it("rejects duplicate unit names and lets Escape cancel inline edits", () => {
  mount(vi.fn());
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Add unit A 0" }));
  fireEvent.click(screen.getByRole("button", { name: "Unit name A 2" }));
  const input = screen.getByRole("textbox", { name: "Unit name A 2" });
  fireEvent.change(input, { target: { value: "1" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.getByRole("button", { name: "Unit name A 2" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Unit name A 2" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Unit name A 2" }), {
    target: { value: "1" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Unit name A 2" }), { key: "Enter" });
  expect(
    screen.getByRole("button", { name: "Continue to next step" }).hasAttribute("disabled"),
  ).toBe(true);
});

it.each(["he", "en", "ru"] as const)(
  "shows translated actionable service errors without technical details in %s",
  async (lang) => {
    const reasons: [
      PublicErrorReason,
      "setupServiceIncomplete" | "setupServiceUnavailable" | "setupLayoutConflict",
    ][] = [
      ["SERVICE_SETUP_INCOMPLETE", "setupServiceIncomplete"],
      ["SERVICE_UNAVAILABLE", "setupServiceUnavailable"],
      ["LAYOUT_CONFLICT", "setupLayoutConflict"],
    ];
    const create = vi.fn();
    mount(create, lang);
    review(lang);
    for (const [reason, key] of reasons) {
      create.mockRejectedValueOnce(new ProjectSetupRequestError(500, reason));
      fireEvent.click(screen.getByRole("button", { name: translate(lang, "create") }));
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toContain(translate(lang, key)),
      );
      expect(screen.getByRole("alert").textContent).not.toContain(reason);
    }
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "back") }));
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "back") }));
    expect(
      screen.getByRole("button", { name: `${translate(lang, "editorUnitName")} A 1` }),
    ).toBeTruthy();
  },
);
it("restores a local draft explicitly, including non-contiguous labels", async () => {
  const first = mount(vi.fn());
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Unit name A 1" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Unit name A 1" }), {
    target: { value: "Studio-X" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Unit name A 1" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(localStorage.getItem(SETUP_DRAFT_KEY)).toContain("Studio-X");
  first.unmount();
  mount(vi.fn());
  fireEvent.click(screen.getByRole("button", { name: "Restore saved draft" }));
  expect(screen.getByRole("button", { name: "Unit name A Studio-X" })).toBeTruthy();
});
it("pauses autosave and creation when another tab changes the draft", () => {
  mount(vi.fn());
  review();
  fireEvent(window, new StorageEvent("storage", { key: SETUP_DRAFT_KEY, newValue: "{}" }));
  expect(screen.getByRole("alert").textContent).toContain("another tab");
  expect(screen.getByRole("button", { name: "Create" }).hasAttribute("disabled")).toBe(true);
});
it("reports storage failure without claiming the draft is saved", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  mount(vi.fn());
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByText("Cannot save draft on this device. Keep this page open.")).toBeTruthy();
});

it("shows saving feedback below the button and confirms manual and debounced saves in green", () => {
  vi.useFakeTimers();
  mount(vi.fn());
  const button = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  const feedback = screen.getByText("Saving draft…");
  expect(button.nextElementSibling).toBe(feedback);
  expect(screen.queryByText("Draft saved on this device")).toBeNull();
  act(() => vi.advanceTimersByTime(400));
  expect(button.getAttribute("aria-busy")).not.toBe("true");
  expect(screen.getByText("Draft saved on this device").className).toContain("text-primary");
  expect(button.className).toContain("bg-primary/10");

  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "First" } });
  expect(screen.queryByText("Draft saved on this device")).toBeNull();
  expect(button.className).not.toContain("bg-primary/10");
  act(() => vi.advanceTimersByTime(499));
  expect(JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!).name).toBe("");
  act(() => vi.advanceTimersByTime(1));
  expect(JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!).name).toBe("First");
  expect(button.getAttribute("aria-busy")).toBe("true");

  // A new edit must cancel the previous save's pending success feedback.
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Latest" } });
  act(() => vi.advanceTimersByTime(400));
  expect(screen.queryByText("Draft saved on this device")).toBeNull();
  act(() => vi.advanceTimersByTime(100));
  expect(JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!).name).toBe("Latest");
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByText("Draft saved on this device").className).toContain("text-primary");
});

it("cancels a pending autosave when saving manually", () => {
  vi.useFakeTimers();
  mount(vi.fn());
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Community" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  const stored = localStorage.getItem(SETUP_DRAFT_KEY);
  act(() => vi.advanceTimersByTime(1000));
  expect(localStorage.getItem(SETUP_DRAFT_KEY)).toBe(stored);
  expect(screen.getByText("Draft saved on this device")).toBeTruthy();
});

it.each(["he", "en", "ru"] as const)("clones a building from its header in %s", (lang) => {
  mount(vi.fn(), lang);
  fill(lang);
  const button = screen.getByRole("button", {
    name: `${translate(lang, "editorCloneBuilding")} A`,
  });
  expect(button.nextElementSibling?.getAttribute("aria-label")).toBe(
    `${translate(lang, "remove")} ${translate(lang, "building")} A`,
  );
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "editorSaveDraft") }));
  const saved = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!);
  expect(saved.buildings.map((b: { name: string }) => b.name)).toEqual(["A", "A (2)"]);
  expect(saved.buildings[1].floors[0].apartments[0].number).toBe("1");
  expect(saved.buildings[1].floors[0].apartments[0].id).not.toBe(
    saved.buildings[0].floors[0].apartments[0].id,
  );
  expect(
    screen.getByRole("button", { name: translate(lang, "editorNext") }).hasAttribute("disabled"),
  ).toBe(false);
});

it("adds floors from the building header and reveals the new highest floor when collapsed", () => {
  mount(vi.fn());
  fill();
  const add = screen.getByRole("button", { name: "Add floor A" });
  expect(add.closest("header")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Collapse all Building A" }));
  expect(screen.queryByRole("spinbutton", { name: "Level A 0" })).toBeNull();
  fireEvent.click(add);
  const card = within(add.closest("article")!);
  expect(card.getAllByRole("spinbutton").map((input) => (input as HTMLInputElement).value)).toEqual(
    ["1", "0"],
  );
  expect(card.getByRole("button", { name: "Unit name A 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  const saved = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!);
  expect(saved.buildings[0].floors.map((floor: { number: number }) => floor.number)).toEqual([
    0, 1,
  ]);
  expect(saved.buildings[0].floors[1].name).toBe("Floor 1");
});

function saveCopyDraft() {
  const buildings = ["A", "B", "C"].map((name) => ({
    id: name,
    name,
    address: `${name} street`,
    floors: [
      {
        id: `${name}-floor`,
        number: 0,
        name: `${name} ground`,
        type: "residential",
        apartments: [
          {
            id: `${name}-unit`,
            number: `${name}-1`,
            type: "residential",
            ...(name === "C" ? { linked: true } : {}),
          },
        ],
      },
    ],
  }));
  localStorage.setItem(
    SETUP_DRAFT_KEY,
    JSON.stringify({
      version: 2,
      revision: "copy-draft",
      name: "Community",
      city: "Sderot",
      step: 1,
      buildings,
    }),
  );
  return buildings;
}

it.each(["he", "en", "ru"] as const)(
  "copies layout only to explicitly selected buildings in %s",
  (lang) => {
    const original = saveCopyDraft();
    mount(vi.fn(), lang);
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "editorRestore") }));
    const source = screen
      .getByRole("button", { name: `${translate(lang, "editorCloneBuilding")} A` })
      .closest("article")!;
    const open = () =>
      fireEvent.click(
        within(source).getByRole("button", { name: translate(lang, "layoutCopyBuildings") }),
      );
    open();
    let dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByRole("checkbox", { name: /A street/ })).toBeNull();
    expect((dialog.getByRole("checkbox", { name: /B street/ }) as HTMLInputElement).checked).toBe(
      false,
    );
    expect((dialog.getByRole("checkbox", { name: /C street/ }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      dialog.getByRole("button", { name: translate(lang, "editorApply") }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.click(dialog.getByRole("checkbox", { name: /B street/ }));
    fireEvent.click(dialog.getByRole("button", { name: translate(lang, "cancel") }));
    expect(
      screen.getByRole("button", {
        name: `${translate(lang, "editorUnitName")} B B-1`,
      }),
    ).toBeTruthy();
    open();
    dialog = within(screen.getByRole("dialog"));
    expect((dialog.getByRole("checkbox", { name: /B street/ }) as HTMLInputElement).checked).toBe(
      false,
    );
    fireEvent.click(dialog.getByRole("checkbox", { name: /B street/ }));
    fireEvent.click(dialog.getByRole("button", { name: translate(lang, "editorApply") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "editorSaveDraft") }));
    const saved = JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY)!);
    expect(saved.buildings[0]).toEqual(original[0]);
    expect(saved.buildings[2]).toEqual(original[2]);
    expect(saved.buildings[1]).toMatchObject({
      id: "B",
      name: "B",
      address: "B street",
      floors: [{ number: 0, name: "A ground", apartments: [{ number: "A-1" }] }],
    });
    expect(saved.buildings[1].floors[0].id).not.toBe(original[0].floors[0].id);
    expect(saved.buildings[1].floors[0].id).not.toBe(original[1].floors[0].id);
  },
);
