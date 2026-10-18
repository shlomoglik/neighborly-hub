// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("./use-management", () => ({ useManagement: vi.fn() }));
vi.mock("./structure-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./structure-api")>()),
  saveStructure: vi.fn(),
}));
import { useManagement } from "./use-management";
import { saveStructure } from "./structure-api";
import { LiveManagement } from "./LiveManagement";
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
function state(): ReturnType<typeof useManagement> {
  return {
    key: "key",
    status: "ready",
    selectedProjectId: projectId,
    buildingId: "",
    discovery: {
      projects: [],
      page: 1,
      hasNext: false,
      canCreateProject: false,
      hasManagementAccess: true,
    },
    data: {
      id: projectId,
      name: "Project",
      city: null,
      canAddBuilding: false,
      buildings: [{ id: buildingId, name: "Building", floors: [] }],
      counts: { buildings: 1, floors: 0, apartments: 0 },
    },
    onBuildingChange: vi.fn(),
    onPageChange: vi.fn(),
    onRefresh: vi.fn(),
    onAccessLost: vi.fn(),
  };
}
function view() {
  return (
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <LiveManagement projectId={projectId} />
    </I18nContext.Provider>
  );
}
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("preserves a draft during revalidation and closes it when the parent leaves authorized scope", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  const rendered = render(view());
  fireEvent.click(screen.getByRole("button", { name: "Add floor" }));
  fireEvent.change(screen.getByLabelText("Number"), { target: { value: "-1" } });
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "loading", data: null });
  rendered.rerender(view());
  expect((screen.getByLabelText("Number") as HTMLInputElement).value).toBe("-1");
  expect(screen.getByLabelText("Number").hasAttribute("disabled")).toBe(true);
  vi.mocked(useManagement).mockReturnValue({
    ...initial,
    data: { ...initial.data!, buildings: [], counts: { buildings: 0, floors: 0, apartments: 0 } },
  });
  rendered.rerender(view());
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(saveStructure).not.toHaveBeenCalled();
});
it("closes only after confirmed save and refreshes rather than fabricating a new hierarchy row", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  vi.mocked(saveStructure).mockResolvedValue({ id: "saved" });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Add floor" }));
  fireEvent.change(screen.getByLabelText("Number"), { target: { value: "0" } });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
  await waitFor(() => expect(initial.onRefresh).toHaveBeenCalledOnce());
  expect(saveStructure).toHaveBeenCalledWith(
    projectId,
    { mode: "create", entity: "floor", buildingId },
    "0",
    expect.any(AbortSignal),
  );
  expect(screen.getByText("This building has no floors yet.")).toBeTruthy();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});
