// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { ProjectSetupWizard } from "./ProjectSetupWizard";
import { ProjectSetupRequestError } from "./project-setup-api";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
import type { ProjectSetupResult } from "@/lib/db/project-setup-input";
afterEach(cleanup);
const result = { projectId: "c44c9aec-f8e4-46b3-9957-12ceba088994" };
function mount(
  onCreate: NonNullable<Parameters<typeof ProjectSetupWizard>[0]["onCreate"]>,
  lang: Lang = "en",
) {
  render(
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
function review(lang: Lang = "en") {
  fireEvent.change(screen.getByLabelText(translate(lang, "projectName")), {
    target: { value: " Community " },
  });
  fireEvent.change(screen.getByLabelText(translate(lang, "city")), {
    target: { value: " Sderot " },
  });
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "buildings") }));
  fireEvent.change(screen.getByLabelText(translate(lang, "building")), {
    target: { value: " A " },
  });
  fireEvent.change(screen.getByLabelText(translate(lang, "floors")), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText(translate(lang, "unitsPerFloor")), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: translate(lang, "stepReview") }));
}
it.each(["he", "en", "ru"] as const)(
  "submits normalized values and shows actual success in %s",
  async (lang) => {
    const create = vi.fn().mockResolvedValue(result);
    mount(create, lang);
    review(lang);
    fireEvent.click(screen.getByRole("button", { name: translate(lang, "create") }));
    await screen.findByRole("heading", { name: translate(lang, "setupCreated") });
    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: "Community",
      city: "Sderot",
      buildings: [{ name: "A", floors: 2, unitsPerFloor: 3 }],
    });
    expect(
      screen
        .getByRole("link", { name: translate(lang, "openProjectManagement") })
        .getAttribute("href"),
    ).toBe(`/manage?project=${result.projectId}`);
    expect(screen.queryByRole("button", { name: translate(lang, "create") })).toBeNull();
  },
);
it("keeps draft values, blocks navigation and double submission while saving, and renders a skeleton", async () => {
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
  expect(create).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("status").querySelectorAll(".motion-safe\\:animate-pulse")).toHaveLength(
    2,
  );
  expect(screen.getByRole("button", { name: "Back" }).hasAttribute("disabled")).toBe(true);
  finish(result);
  await screen.findByRole("heading", { name: "Project created" });
});
it.each([
  [401, "setupExpired"],
  [403, "setupForbidden"],
  [400, "setupInvalid"],
  [500, "setupFailed"],
] as const)(
  "retains the draft and explains HTTP %s without a false success",
  async (status, key) => {
    const create = vi.fn().mockRejectedValue(new ProjectSetupRequestError(status));
    mount(create);
    review();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(translate("en", key)),
    );
    expect(screen.getByText("Community — Sderot", { exact: false })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Project created" })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  },
);
it("uses shared bounds and rejects duplicate building names before review", () => {
  mount(vi.fn());
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Community" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Sderot" } });
  fireEvent.click(screen.getByRole("button", { name: "Buildings" }));
  fireEvent.change(screen.getByLabelText("Building"), { target: { value: "A" } });
  fireEvent.click(screen.getByRole("button", { name: translate("en", "addBuilding") }));
  fireEvent.change(screen.getAllByLabelText("Building")[1], { target: { value: " a " } });
  expect(
    screen.getByRole("button", { name: translate("en", "stepReview") }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.change(screen.getAllByLabelText("Building")[1], { target: { value: "B" } });
  fireEvent.change(screen.getAllByLabelText(translate("en", "floors"))[0], {
    target: { value: "201" },
  });
  expect(
    screen.getByRole("button", { name: translate("en", "stepReview") }).hasAttribute("disabled"),
  ).toBe(true);
});

it("copies only the layout, retains individual addresses and accepts a floor override", async () => {
  const create = vi.fn().mockResolvedValue(result);
  mount(create);
  fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Community" } });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Sderot" } });
  fireEvent.click(screen.getByRole("button", { name: "Buildings" }));
  fireEvent.change(screen.getByLabelText("Building"), { target: { value: "A" } });
  fireEvent.change(screen.getByLabelText("Building address"), { target: { value: "Street 1" } });
  fireEvent.change(screen.getByLabelText(translate("en", "floors")), { target: { value: "2" } });
  fireEvent.change(
    screen.getByLabelText(translate("en", "layoutFloorCount", { floor: 0, building: "A" })),
    { target: { value: "0" } },
  );
  fireEvent.click(screen.getByRole("button", { name: translate("en", "addBuilding") }));
  fireEvent.change(screen.getAllByLabelText("Building")[1], { target: { value: "B" } });
  fireEvent.change(screen.getAllByLabelText("Building address")[1], {
    target: { value: "Street 2" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: translate("en", "layoutCopyAll") })[0]);
  fireEvent.change(
    screen.getByLabelText(translate("en", "layoutFloorCount", { floor: 1, building: "B" })),
    { target: { value: "3" } },
  );
  fireEvent.click(screen.getByRole("button", { name: translate("en", "stepReview") }));
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  expect(create.mock.calls[0][0].buildings).toEqual([
    { name: "A", address: "Street 1", floors: 2, unitsPerFloor: 1, floorUnits: [0, 1] },
    { name: "B", address: "Street 2", floors: 2, unitsPerFloor: 1, floorUnits: [0, 3] },
  ]);
});
