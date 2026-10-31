// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDirectory } from "./use-directory";
import type { DirectoryApi } from "./directory-api";
import { ResidentDirectory, type ResidentDirectoryProps } from "./ResidentDirectory";
import { I18nContext } from "@/lib/i18n/context";
import { directionFor, translate, type Lang } from "@/lib/i18n/dictionary";
const props = (): ResidentDirectoryProps => ({
  status: "ready",
  projects: [{ id: "p", name: "Project", buildings: [{ id: "b", name: "Building" }] }],
  selectedProjectId: "p",
  query: { query: "", buildingId: "", page: 2 },
  data: {
    page: 2,
    hasNext: true,
    residents: [
      {
        personId: "person",
        name: "Private resident",
        householdId: "home",
        householdName: "Family",
        buildingId: "b",
        buildingName: "Building",
        apartment: "1",
        contacts: [{ kind: "phone", value: "0501234567", label: null }],
      },
    ],
  },
  onProjectChange: vi.fn(),
  onBuildingChange: vi.fn(),
  onQueryChange: vi.fn(),
  onPageChange: vi.fn(),
  onRefresh: vi.fn(),
});
function localized(value: ResidentDirectoryProps, lang: Lang = "en") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <ResidentDirectory {...value} />
    </I18nContext.Provider>
  );
}
afterEach(cleanup);
it.each(["he", "en", "ru"] as const)(
  "provides localized controls and authorized contacts in %s",
  (lang) => {
    render(localized(props(), lang));
    expect(screen.getByRole("heading", { name: translate(lang, "directory") })).toBeTruthy();
    expect(screen.getByRole("link", { name: translate(lang, "call") }).getAttribute("href")).toBe(
      "tel:0501234567",
    );
    expect(screen.getByLabelText(translate(lang, "project"))).toBeTruthy();
    expect(
      screen.getByRole("link", { name: translate(lang, "homeOpen") }).getAttribute("href"),
    ).toBe("/household/home");
  },
);
it("forwards user interactions without doing API work", () => {
  const value = props();
  render(localized(value));
  fireEvent.change(screen.getByLabelText("Project"), { target: { value: "p" } });
  expect(value.onProjectChange).toHaveBeenCalledWith("p");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Noa" } });
  expect(value.onQueryChange).toHaveBeenCalledWith("Noa");
  fireEvent.change(screen.getByLabelText(translate("en", "filterBuilding")), {
    target: { value: "b" },
  });
  expect(value.onBuildingChange).toHaveBeenCalledWith("b");
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect(value.onPageChange).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(value.onPageChange).toHaveBeenCalledWith(3);
  fireEvent.click(screen.getByRole("button", { name: "Refresh directory" }));
  expect(value.onRefresh).toHaveBeenCalled();
});
it.each(["loading", "forbidden", "expired", "unlinked", "error"] as const)(
  "never renders previous resident values in %s state",
  (status) => {
    render(localized({ ...props(), status }));
    expect(screen.queryByText("Private resident")).toBeNull();
    expect(screen.queryByText("0501234567")).toBeNull();
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
    if (status === "loading")
      expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    if (status === "expired")
      expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth");
  },
);
it("announces an empty page and disables unavailable pagination", () => {
  render(localized({ ...props(), data: { residents: [], page: 1, hasNext: false } }));
  expect(screen.getByText(translate("en", "noResults"))).toBeTruthy();
  expect(screen.getByRole("button", { name: "Previous page" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Next page" }).hasAttribute("disabled")).toBe(true);
});

it("moves keyboard focus to the directory heading after changing pages", () => {
  const value = props();
  const { rerender } = render(localized(value));
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  rerender(localized({ ...value, status: "loading", data: null }));
  rerender(localized({ ...value, data: { residents: [], page: 3, hasNext: false } }));
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Neighbors" }));
});

it.each(["he", "en", "ru"] as const)(
  "explains contact search and filtered emptiness in %s",
  (lang) => {
    const value = props();
    const { rerender } = render(
      localized({ ...value, data: { residents: [], page: 1, hasNext: false } }, lang),
    );
    expect(screen.getByText(translate(lang, "allBuildings"), { selector: "bdi" })).toBeTruthy();
    expect(screen.queryByText(translate(lang, "emptyBook"))).toBeNull();
    expect(
      screen.getByRole("button", { name: translate(lang, "clear") }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: translate(lang, "globalSearch") }).getAttribute("href"),
    ).toBe("/search");
    const input = screen.getByRole("textbox");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain(
      translate(lang, "globalSearchHint"),
    );
    rerender(
      localized(
        {
          ...value,
          query: { query: "Nobody", buildingId: "b", page: 1 },
          data: { residents: [], page: 1, hasNext: false },
        },
        lang,
      ),
    );
    expect(screen.getByText("Nobody")).toBeTruthy();
    expect(screen.getByText("Building", { selector: "bdi" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: translate(lang, "clear") }).at(-1)!);
    expect(value.onQueryChange).toHaveBeenCalledWith("");
    expect(value.onBuildingChange).toHaveBeenCalledWith("");
    expect(document.activeElement).toBe(input);
  },
);

it("keeps search focus and hides private rows through repeated refreshes", () => {
  const value = props();
  const { rerender } = render(localized(value));
  const input = screen.getByRole("textbox");
  input.focus();
  for (let i = 0; i < 2; i++) {
    rerender(localized({ ...value, status: "loading", data: null }));
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText("Private resident")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toHaveProperty("disabled", true);
    rerender(localized(value));
    expect(document.activeElement).toBe(input);
  }
});

it("clears both filters and returns to page one using the existing hook", async () => {
  vi.useFakeTimers();
  const service: DirectoryApi = {
    projects: vi.fn().mockResolvedValue(props().projects),
    residents: vi.fn<DirectoryApi["residents"]>().mockImplementation(async (_project, query) => ({
      residents: [],
      page: query.page,
      hasNext: true,
    })),
  };
  function Directory() {
    return localized(useDirectory(service));
  }
  const tick = () =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
  try {
    render(<Directory />);
    await tick();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nobody" } });
    fireEvent.change(screen.getByLabelText(translate("en", "filterBuilding")), {
      target: { value: "b" },
    });
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await tick();
    expect(screen.getByText("Page 2")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear" }).at(-1)!);
    await tick();
    expect(service.residents).toHaveBeenLastCalledWith(
      "p",
      { query: "", buildingId: "", page: 1 },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("textbox")).toHaveProperty("value", "");
    expect(screen.getByLabelText(translate("en", "filterBuilding"))).toHaveProperty("value", "");
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});
