// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "../../lib/i18n/context";
import { translate, directionFor, type Lang } from "../../lib/i18n/dictionary";
const { social, signOut, replace, refresh } = vi.hoisted(() => ({
  social: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./client", () => ({ authClient: { signIn: { social }, signOut } }));
import { SignIn } from "./SignIn";
import { SignOut } from "./SignOut";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
function localized(enabled: boolean, lang: Lang = "en") {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <SignIn enabled={enabled} />
    </I18nContext.Provider>
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it.each(["he", "en", "ru"] as const)(
  "shows an unavailable sign-in state in %s without offering fake credentials",
  (lang) => {
    render(localized(false, lang));
    expect(
      screen.getByRole("button", { name: translate(lang, "google") }).hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(translate(lang, "authUnavailable"));
    expect(screen.queryByRole("textbox")).toBeNull();
  },
);
it("prevents repeated submissions and uses fixed same-origin destinations", async () => {
  social.mockImplementation(() => new Promise(() => {}));
  render(localized(true));
  const button = screen.getByRole("button", { name: translate("en", "google") });
  fireEvent.click(button);
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
  fireEvent.click(button);
  expect(social).toHaveBeenCalledTimes(1);
  expect(social).toHaveBeenCalledWith({
    provider: "google",
    callbackURL: "/directory",
    errorCallbackURL: "/auth?error=sign-in",
  });
});
it("maps provider errors to a localized message and allows retry", async () => {
  social.mockResolvedValue({ error: { message: "must-not-expose-provider-details" } });
  render(localized(true));
  fireEvent.click(screen.getByRole("button", { name: translate("en", "google") }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(translate("en", "authFailed")),
  );
  expect(screen.queryByText("must-not-expose-provider-details")).toBeNull();
  expect(
    screen.getByRole("button", { name: translate("en", "google") }).hasAttribute("disabled"),
  ).toBe(false);
});

it("navigates away only after successful sign-out", async () => {
  signOut.mockResolvedValue({ data: { success: true } });
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <SignOut />
    </I18nContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth"));
  expect(refresh).toHaveBeenCalled();
});
it("keeps the current account visible when sign-out fails", async () => {
  signOut.mockResolvedValue({ error: { message: "private-provider-error" } });
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <SignOut />
    </I18nContext.Provider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(translate("en", "authSignOutFailed")),
  );
  expect(replace).not.toHaveBeenCalled();
});
