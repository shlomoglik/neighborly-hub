// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { StaffWorkspace, type StaffWorkspaceProps } from "./StaffWorkspace";
afterEach(cleanup);
const projectId = "c44c9aec-f8e4-46b3-9957-12ceba088994";
const buildingId = "27e8d799-5714-4f4f-831d-715a0cced685";
function mount(lang: Lang = "en", overrides: Partial<StaffWorkspaceProps> = {}) {
  const props: StaffWorkspaceProps = {
    projectId,
    status: "ready",
    busy: false,
    notice: null,
    data: {
      project: { id: projectId, name: "Saved project" },
      buildings: [{ id: buildingId, name: "Building A" }],
      assignments: [
        {
          id: "assignment",
          email: "manager@example.test",
          name: "Manager",
          role: "building_manager",
          buildingId,
        },
      ],
      page: 1,
      hasNext: false,
    },
    onAdd: vi.fn().mockResolvedValue(true),
    onRemove: vi.fn().mockResolvedValue(true),
    onPageChange: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
  render(
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <StaffWorkspace {...props} />
    </I18nContext.Provider>,
  );
  return props;
}
it.each(["he", "en", "ru"] as const)(
  "submits exact existing email and explicitly selected building scope in %s",
  async (lang) => {
    const p = mount(lang);
    fireEvent.change(screen.getByLabelText(translate(lang, "email")), {
      target: { value: " TARGET@example.test " },
    });
    fireEvent.change(screen.getByLabelText(translate(lang, "staffRole")), {
      target: { value: "building_manager" },
    });
    expect(
      screen.getByRole("button", { name: translate(lang, "staffAdd") }).hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByLabelText(translate(lang, "building")), {
      target: { value: buildingId },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: translate(lang, "staffAdd") }).closest("form")!,
    );
    await waitFor(() =>
      expect(p.onAdd).toHaveBeenCalledWith({
        email: "target@example.test",
        role: "building_manager",
        buildingId,
      }),
    );
    expect(
      screen.getByRole("link", { name: translate(lang, "backToProject") }).getAttribute("href"),
    ).toBe(`/manage/project/${projectId}`);
  },
);
it("requires explicit confirmation before revoking and allows cancellation", async () => {
  const p = mount();
  fireEvent.click(screen.getByRole("button", { name: /Revoke assignment for/ }));
  expect(p.onRemove).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog").textContent).toContain("manager@example.test");
  expect(screen.getByRole("alertdialog").textContent).toContain("Building A");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(p.onRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Revoke assignment for/ }));
  fireEvent.click(screen.getByRole("button", { name: "Revoke assignment" }));
  await waitFor(() => expect(p.onRemove).toHaveBeenCalledExactlyOnceWith("assignment"));
});
it("blocks controls while writing and retains a draft on failure", async () => {
  const p = mount("en", { onAdd: vi.fn().mockResolvedValue(false) });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "target@example.test" } });
  fireEvent.submit(screen.getByRole("button", { name: "Add assignment" }).closest("form")!);
  await waitFor(() => expect(p.onAdd).toHaveBeenCalledOnce());
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("target@example.test");
  cleanup();
  mount("en", { busy: true });
  expect(screen.getByLabelText("Email").closest("fieldset")?.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByRole("button", { name: /Revoke assignment for/ }).hasAttribute("disabled"),
  ).toBe(true);
});
it.each(["he", "en", "ru"] as const)(
  "localizes loading, empty, expired and failure states in %s",
  (lang) => {
    for (const [status, key] of [
      ["loading", "loading"],
      ["forbidden", "staffAdminOnly"],
      ["unavailable", "managementUnavailable"],
      ["expired", "managementExpired"],
      ["error", "loadError"],
    ] as const) {
      mount(lang, { status, data: null });
      expect(screen.getByText(translate(lang, key))).toBeTruthy();
      expect(screen.queryByText("manager@example.test")).toBeNull();
      cleanup();
    }
    mount(lang, {
      data: {
        project: { id: projectId, name: "Empty project" },
        buildings: [],
        assignments: [],
        page: 1,
        hasNext: false,
      },
    });
    expect(screen.getByText(translate(lang, "staffEmpty"))).toBeTruthy();
  },
);
