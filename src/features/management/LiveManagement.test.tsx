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
    buildingId,
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
it("remembers the default building selection for authorization revalidation", () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue({ ...initial, buildingId: "" });
  render(view());
  expect(initial.onBuildingChange).toHaveBeenCalledWith(buildingId);
});
it("preserves the draft during revalidation and removes it when authorization is lost", async () => {
  const initial = state();
  vi.mocked(useManagement).mockReturnValue(initial);
  const rendered = render(view());
  editUnit();
  vi.mocked(useManagement).mockReturnValue({ ...initial, status: "loading", data: null });
  rendered.rerender(view());
  expect(
    screen
      .getByRole("button", { name: "Unit name Building Suite-A" })
      .closest("fieldset")
      ?.hasAttribute("disabled"),
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
  fireEvent.click(screen.getByRole("radio", { name: "Other building" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(initial.onBuildingChange).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Unit name Building Suite-A" })).toBeTruthy();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("radio", { name: "Other building" }));
  expect(initial.onBuildingChange).toHaveBeenCalledWith(otherId);
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
