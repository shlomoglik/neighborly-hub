// @vitest-environment jsdom
import { Suspense, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate, directionFor, type Lang } from "@/lib/i18n/dictionary";
import { HouseholdDetails } from "./HouseholdDetails";
import { HouseholdLayout } from "./HouseholdLayout";
import { householdApi } from "./household-api";
import type { HouseholdDetail } from "@/lib/access/household-contracts";
const route = vi.hoisted(() => ({ path: "/household/one" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("./household-api", () => ({ householdApi: { detail: vi.fn(), update: vi.fn() } }));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children, activePath }: { children: ReactNode; activePath?: string }) => (
    <main data-active-path={activePath}>{children}</main>
  ),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
const home: HouseholdDetail = {
  id: "one",
  name: "Family",
  project: "Project",
  building: "A",
  apartment: "1",
  floor: 0,
  canRename: true,
  ownContacts: [],
  members: [],
  page: 1,
  hasNext: false,
};
function view(children: ReactNode, lang: Lang = "en", id = "one") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <HouseholdLayout id={id}>
        <Suspense fallback={<div>Loading content</div>}>{children}</Suspense>
      </HouseholdLayout>
    </I18nContext.Provider>
  );
}
function Pending(): ReactNode {
  throw new Promise(() => {});
}
it.each(["he", "en", "ru"] as const)(
  "keeps the header mounted and does not fetch again when changing tabs in %s",
  async (lang) => {
    vi.mocked(householdApi.detail).mockResolvedValue(home);
    route.path = "/household/one";
    const rendered = render(view(<div>Details</div>, lang));
    const heading = await screen.findByRole("heading", { name: "Family", level: 1 });
    route.path = "/household/one/members";
    rendered.rerender(view(<Pending />, lang));
    expect(screen.getByRole("heading", { name: "Family", level: 1 })).toBe(heading);
    expect(screen.getByText("Loading content")).toBeTruthy();
    expect(householdApi.detail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("main").getAttribute("data-active-path")).toBe("/household");
    const tabs = screen.getByRole("navigation", { name: translate(lang, "householdSections") });
    expect(
      within(tabs)
        .getByRole("link", { name: translate(lang, "familyManage") })
        .getAttribute("aria-current"),
    ).toBe("page");
    const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(
      within(breadcrumb)
        .getByRole("link", { name: translate(lang, "homeMine") })
        .getAttribute("href"),
    ).toBe("/household");
    expect(
      within(breadcrumb).getByText(translate(lang, "familyManage")).getAttribute("aria-current"),
    ).toBe("page");
  },
);
it("uses directory navigation for another household and hides family editing from non-representatives", async () => {
  vi.mocked(householdApi.detail).mockResolvedValue({
    ...home,
    canRename: false,
    ownContacts: null,
  });
  render(view(<div>Content</div>));
  await screen.findByRole("heading", { name: "Family" });
  expect(screen.getByRole("main").getAttribute("data-active-path")).toBe("/directory");
  const breadcrumb = screen.getByRole("navigation", { name: "breadcrumb" });
  expect(
    within(breadcrumb)
      .getByRole("link", { name: translate("en", "directory") })
      .getAttribute("href"),
  ).toBe("/directory");
  const tabs = screen.getByRole("navigation", { name: translate("en", "householdSections") });
  expect(within(tabs).queryByRole("link", { name: translate("en", "familyManage") })).toBeNull();
});
it("does not expose the previous household's name during navigation to another household", async () => {
  vi.mocked(householdApi.detail)
    .mockResolvedValueOnce(home)
    .mockReturnValue(new Promise(() => {}));
  const rendered = render(view(<div>Content</div>));
  await screen.findByRole("heading", { name: "Family" });
  rendered.rerender(view(<Pending />, "en", "two"));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Family" })).toBeNull());
});

it("shares the detail read and updates the persistent heading after a successful rename", async () => {
  vi.mocked(householdApi.detail)
    .mockResolvedValueOnce(home)
    .mockResolvedValue({ ...home, name: "Updated family" });
  vi.mocked(householdApi.update).mockResolvedValue({ id: home.id });
  route.path = "/household/one";
  render(view(<HouseholdDetails id="one" />));
  await screen.findByRole("button", { name: "Edit household name" });
  expect(householdApi.detail).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole("heading", { name: "Family" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Edit household name" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Updated family" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("heading", { name: "Updated family", level: 1 });
  expect(householdApi.update).toHaveBeenCalledWith(
    "one",
    { action: "rename", name: "Updated family", expected: "Family" },
    expect.any(AbortSignal),
  );
  expect(householdApi.detail).toHaveBeenCalledTimes(2);
});

it("keeps the editor and its focus through polling and window focus refreshes", async () => {
  vi.useFakeTimers();
  vi.mocked(householdApi.detail)
    .mockResolvedValueOnce(home)
    .mockImplementation(() => new Promise(() => {}));
  route.path = "/household/one";
  await act(async () => {
    render(view(<HouseholdDetails id="one" />));
  });

  fireEvent.click(screen.getByRole("button", { name: "Edit household name" }));
  const input = screen.getByRole<HTMLInputElement>("textbox");
  input.focus();
  fireEvent.change(input, { target: { value: "Unsaved family name" } });

  act(() => vi.advanceTimersByTime(30_000));
  expect(householdApi.detail).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(document.activeElement).toBe(input);

  fireEvent.focus(window);
  expect(householdApi.detail).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("textbox")).toBe(input);
  expect(input.value).toBe("Unsaved family name");
  expect(screen.queryByText(translate("en", "loading"))).toBeNull();
});

it("does not cancel a pending rename when the window refocuses", async () => {
  let completeRename!: (value: { id: string }) => void;
  const rename = new Promise<{ id: string }>((resolve) => {
    completeRename = resolve;
  });
  vi.mocked(householdApi.detail)
    .mockResolvedValueOnce(home)
    .mockResolvedValueOnce(home)
    .mockResolvedValue({ ...home, name: "Updated family" });
  vi.mocked(householdApi.update).mockReturnValue(rename);
  route.path = "/household/one";
  render(view(<HouseholdDetails id="one" />));
  fireEvent.click(await screen.findByRole("button", { name: "Edit household name" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Updated family" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await act(async () => {
    fireEvent.focus(window);
  });
  expect(householdApi.detail).toHaveBeenCalledTimes(2);
  expect(vi.mocked(householdApi.update).mock.calls[0][2]?.aborted).toBe(false);

  await act(async () => completeRename({ id: home.id }));
  expect(screen.getByRole("heading", { name: "Updated family", level: 1 })).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});
