// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
import { GlobalSearch } from "./GlobalSearch";
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => children,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount() {
  return render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <GlobalSearch />
    </I18nContext.Provider>,
  );
}
it("searches on submission, shows project context and clears stale results when input changes", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      residents: [
        {
          personId: "p",
          name: "Alice",
          householdId: "h",
          householdName: "Family",
          buildingId: "b",
          buildingName: "Tower",
          apartment: "2",
          projectId: "project",
          projectName: "Authorized project",
          contacts: [],
        },
      ],
      page: 1,
      hasNext: false,
    }),
  });
  vi.stubGlobal("fetch", fetcher);
  mount();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Alice" } });
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: translate("en", "search") }));
  expect(await screen.findByText("Alice")).toBeTruthy();
  expect(screen.getByText(/Authorized project/)).toBeTruthy();
  expect(fetcher.mock.calls[0][0]).toBe("/api/search?query=Alice&page=1");
  fireEvent.change(input, { target: { value: "Bob" } });
  expect(screen.queryByText("Alice")).toBeNull();
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
});
it("discards previous results on an expired session and offers sign in", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "UNAUTHENTICATED" }),
    }),
  );
  mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } });
  fireEvent.click(screen.getByRole("button", { name: translate("en", "search") }));
  expect(await screen.findByRole("link", { name: translate("en", "signIn") })).toBeTruthy();
  expect(screen.queryByText("Alice")).toBeNull();
});
