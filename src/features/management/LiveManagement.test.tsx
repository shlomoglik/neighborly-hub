// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("./use-management", () => ({ useManagement: vi.fn() }));
vi.mock("@/features/shared/private-api", async (original) => ({
  ...(await original<typeof import("@/features/shared/private-api")>()),
  privateRequest: vi.fn(),
}));
import { useManagement } from "./use-management";
import { privateRequest, PrivateRequestError } from "@/features/shared/private-api";
import { LiveManagement } from "./LiveManagement";
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
const otherId = "27e8d799-5714-4f4f-831d-715a0cced686";
const floorId = "27e8d799-5714-4f4f-831d-715a0cced687";
const unitId = "27e8d799-5714-4f4f-831d-715a0cced688";
function state(): ReturnType<typeof useManagement> {
  return {
    key: "internal-read-key",
    status: "ready",
    selectedProjectId: projectId,
    buildingIds: [buildingId],
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
      buildings: [
        {
          id: buildingId,
          name: "Building",
          address: "Example street",
          version: "a".repeat(64),
          floors: [
            {
              id: floorId,
              number: 0,
              name: "Ground",
              type: "residential",
              apartments: [{ id: unitId, number: "1", type: "residential", position: 0 }],
            },
          ],
        },
        { id: otherId, name: "Other building", version: "b".repeat(64), floors: [] },
      ],
      counts: { buildings: 2, floors: 1, apartments: 1 },
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
function editUnit() {
  fireEvent.click(screen.getByRole("button", { name: "Unit name Building 1" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Unit name Building 1" }), {
    target: { value: "Suite-A" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Unit name Building 1" }), {
    key: "Enter",
  });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("renders the actual shared structure editor inline without spreading the internal React key", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(useManagement).mockReturnValue(state());
  render(view());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Add floor Building" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  expect(JSON.stringify(errors.mock.calls)).not.toContain('containing a "key"');
});
it("shows all authorized buildings by default without forcing a selection", () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue({ ...initial, buildingIds: [] });
  render(view());
  expect(initial.onBuildingChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Add floor Building" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add floor Other building" })).toBeTruthy();
  expect(
    (screen.getByRole("checkbox", { name: "All buildings" }) as HTMLInputElement).checked,
  ).toBe(true);
});
it("preserves the draft during revalidation and removes it when authorization is lost", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  const rendered = render(view());
  editUnit();
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "loading", data: null });
  rendered.rerender(view());
  expect(
    screen.getByRole("button", { name: "Unit name Building Suite-A" }).matches(":disabled"),
  ).toBe(true);
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "unavailable", data: null });
  rendered.rerender(view());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Unit name Building Suite-A" })).toBeNull(),
  );
  expect(privateRequest).not.toHaveBeenCalled();
});
it("saves only the selected building with original IDs and expected version, then refreshes", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  vi.mocked(privateRequest).mockResolvedValue({});
  render(view());
  editUnit();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(initial.onRefresh).toHaveBeenCalledOnce());
  expect(privateRequest).toHaveBeenCalledExactlyOnceWith(
    "/api/management/projects/" + projectId + "/structure",
    expect.any(AbortSignal),
    "PUT",
    expect.objectContaining({
      id: buildingId,
      expectedVersion: "a".repeat(64),
      floors: [
        expect.objectContaining({
          id: floorId,
          number: 0,
          apartments: [expect.objectContaining({ id: unitId, number: "Suite-A" })],
        }),
      ],
    }),
  );
});
it("warns before discarding changes on building switches", () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(view());
  editUnit();
  fireEvent.click(screen.getByRole("checkbox", { name: "Other building" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(initial.onBuildingChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Other building" }));
  expect(initial.onBuildingChange).toHaveBeenCalledWith([buildingId, otherId]);
});
it("keeps stale edits on the original version and provides explicit reload on conflicts", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  const rendered = render(view());
  editUnit();
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "loading", data: null });
  rendered.rerender(view());
  vi.mocked(useManagement).mockReturnValue({
    ...initial,
    data: {
      ...initial.data!,
      buildings: initial.data!.buildings.map((b) => ({ ...b, version: "c".repeat(64) })),
    },
  });
  rendered.rerender(view());
  vi.mocked(privateRequest).mockRejectedValue(new PrivateRequestError(409, "STALE_STRUCTURE"));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(translate("en", "structureStale"));
  expect(privateRequest).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(AbortSignal),
    "PUT",
    expect.objectContaining({ expectedVersion: "a".repeat(64) }),
  );
  fireEvent.click(
    within(alert).getByRole("button", { name: translate("en", "refreshManagement") }),
  );
  expect(initial.onRefresh).toHaveBeenCalledOnce();
});
it("cancel resets the inline draft without sending a write", async () => {
  vi.mocked(useManagement).mockReturnValue(state());
  render(view());
  editUnit();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Unit name Building 1" })).toBeTruthy(),
  );
  expect(privateRequest).not.toHaveBeenCalled();
});
it("shows only the selected subset and restores all buildings", () => {
  const initial = state();
  const third = { id: "third", name: "Third building", version: "d".repeat(64), floors: [] };
  const data = { ...initial.data!, buildings: [...initial.data!.buildings, third] };
  vi.mocked(useManagement).mockReturnValue({
    ...initial,
    data,
    buildingIds: [buildingId, otherId],
  });
  const rendered = render(view());
  expect(screen.getByRole("button", { name: "Add floor Building" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add floor Other building" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add floor Third building" })).toBeNull();
  vi.mocked(useManagement).mockReturnValue({ ...initial, data, buildingIds: [] });
  rendered.rerender(view());
  expect(screen.getByRole("button", { name: "Add floor Third building" })).toBeTruthy();
});
it("saving one building preserves another building's dirty draft and refreshes only the saved draft", async () => {
  const initial = { ...state(), buildingIds: [] };
  vi.mocked(useManagement).mockReturnValue(initial);
  vi.mocked(privateRequest).mockResolvedValue({});
  const rendered = render(view());
  editUnit();
  fireEvent.click(screen.getByRole("button", { name: "Add floor Other building" }));
  const other = screen.getByRole("region", {
    name: `${translate("en", "editorTitle")} · Other building`,
  });
  fireEvent.click(within(other).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(initial.onRefresh).toHaveBeenCalledOnce());
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "loading", data: null });
  rendered.rerender(view());
  const updated = {
    ...initial.data!,
    buildings: initial.data!.buildings.map((b) =>
      b.id === otherId ? { ...b, version: "c".repeat(64) } : b,
    ),
  };
  vi.mocked(useManagement).mockReturnValue({ ...initial, data: updated });
  rendered.rerender(view());
  await waitFor(() =>
    expect(
      within(
        screen.getByRole("region", { name: `${translate("en", "editorTitle")} · Other building` }),
      )
        .getByRole("button", { name: "Save" })
        .hasAttribute("disabled"),
    ).toBe(true),
  );
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  const first = screen.getByRole("region", {
    name: `${translate("en", "editorTitle")} · Building`,
  });
  expect(within(first).getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false);
  expect(privateRequest).toHaveBeenCalledExactlyOnceWith(
    expect.any(String),
    expect.any(AbortSignal),
    "PUT",
    expect.objectContaining({ id: otherId }),
  );
});
it("canceling a building leaves the other building's unsaved changes intact", () => {
  vi.mocked(useManagement).mockReturnValue({ ...state(), buildingIds: [] });
  render(view());
  editUnit();
  fireEvent.click(screen.getByRole("button", { name: "Add floor Other building" }));
  const other = screen.getByRole("region", {
    name: `${translate("en", "editorTitle")} · Other building`,
  });
  fireEvent.click(within(other).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  expect(
    within(
      screen.getByRole("region", { name: `${translate("en", "editorTitle")} · Other building` }),
    )
      .getByRole("button", { name: "Save" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(privateRequest).not.toHaveBeenCalled();
});
it("immediately removes a revoked building while all buildings are displayed", () => {
  const initial = { ...state(), buildingIds: [] };
  vi.mocked(useManagement).mockReturnValue(initial);
  const rendered = render(view());
  vi.mocked(useManagement).mockReturnValue({
    ...initial,
    data: { ...initial.data!, buildings: [initial.data!.buildings[0]] },
  });
  rendered.rerender(view());
  expect(screen.queryByRole("button", { name: "Add floor Other building" })).toBeNull();
  expect(screen.getByRole("button", { name: "Add floor Building" })).toBeTruthy();
});
it("keeps building editors visible after canceling the add-building dialog", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue({
    ...initial,
    data: { ...initial.data!, canAddBuilding: true },
  });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Add building" }));
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("button", { name: "Add floor Building" })).toBeTruthy();
});
it("renders one project toolbar, live summary and checks for multiple buildings", () => {
  vi.mocked(useManagement).mockReturnValue({ ...state(), buildingIds: [] });
  render(view());
  expect(screen.getAllByRole("textbox", { name: translate("en", "editorSearch") })).toHaveLength(1);
  expect(screen.getAllByRole("heading", { name: translate("en", "editorSummary") })).toHaveLength(
    1,
  );
  expect(screen.getAllByRole("heading", { name: translate("en", "editorChecks") })).toHaveLength(1);
  const summary = screen
    .getByRole("heading", { name: translate("en", "editorSummary") })
    .closest("section")!;
  const counts = () => [...summary.querySelectorAll("dd")].map((node) => node.textContent);
  expect(counts()).toEqual(["2", "2", "1"]);
  fireEvent.click(screen.getByRole("button", { name: "Add floor Other building" }));
  expect(counts()).toEqual(["2", "3", "1"]);
  const other = screen.getByRole("region", {
    name: `${translate("en", "editorTitle")} · Other building`,
  });
  fireEvent.click(within(other).getByRole("button", { name: "Cancel" }));
  expect(counts()).toEqual(["2", "2", "1"]);
});
it("searches all selected building drafts through one field without discarding edits", () => {
  vi.mocked(useManagement).mockReturnValue({ ...state(), buildingIds: [] });
  render(view());
  editUnit();
  const search = screen.getByRole("textbox", { name: translate("en", "editorSearch") });
  fireEvent.change(search, { target: { value: "Other building" } });
  expect(screen.queryByRole("button", { name: "Add floor Building" })).toBeNull();
  expect(screen.getByRole("button", { name: "Add floor Other building" })).toBeTruthy();
  fireEvent.change(search, { target: { value: "Suite-A" } });
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add floor Other building" })).toBeNull();
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add floor Other building" })).toBeTruthy();
});
it("compares selected buildings in one table", () => {
  vi.mocked(useManagement).mockReturnValue({ ...state(), buildingIds: [] });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: translate("en", "editorCompare") }));
  const table = screen.getByRole("table", { name: translate("en", "editorCompare") });
  expect(within(table).getByRole("columnheader", { name: /Other building/ })).toBeTruthy();
  expect(within(table).getByRole("columnheader", { name: /^Building/ })).toBeTruthy();
  expect(screen.getAllByRole("heading", { name: translate("en", "editorSummary") })).toHaveLength(
    1,
  );
});
it("updates one shared validation panel when a building draft becomes invalid", () => {
  vi.mocked(useManagement).mockReturnValue({ ...state(), buildingIds: [] });
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "Unit name Building 1" }));
  const input = screen.getByRole("textbox", { name: "Unit name Building 1" });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getAllByRole("heading", { name: translate("en", "editorChecks") })).toHaveLength(1);
  expect(screen.getByRole("alert").textContent).toBe(translate("en", "editorInvalid"));
  const first = screen.getByRole("region", {
    name: `${translate("en", "editorTitle")} · Building`,
  });
  expect(within(first).getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
});
