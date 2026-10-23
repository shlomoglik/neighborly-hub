// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "../../lib/i18n/context";
import { translate, directionFor, type Lang } from "../../lib/i18n/dictionary";
const { social, email, signup, reset, signOut, replace, refresh } = vi.hoisted(() => ({
  social: vi.fn(),
  email: vi.fn(),
  signup: vi.fn(),
  reset: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("./client", () => ({
  authClient: {
    signIn: { social, email },
    signUp: { email: signup },
    requestPasswordReset: reset,
    signOut,
  },
}));
import { SignIn } from "./SignIn";
import { SignOut } from "./SignOut";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
function localized(enabled: boolean, lang: Lang = "en", delivery = false, returnTo?: string) {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <SignIn enabled={enabled} emailDeliveryEnabled={delivery} returnTo={returnTo} />
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

it("signs in with email, preserves invitation destinations and refreshes the session", async () => {
  email.mockResolvedValue({ data: { user: { id: "existing" } } });
  const destination = `/join/${"a".repeat(64)}`;
  render(localized(true, "en", false, destination));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "USER@Example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() =>
    expect(email).toHaveBeenCalledWith({
      email: "user@example.test",
      password: "valid-password-123",
    }),
  );
  expect(replace).toHaveBeenCalledWith(destination);
  expect(refresh).toHaveBeenCalled();
});
it("never redirects or exposes raw credential errors after a failed sign-in", async () => {
  email.mockResolvedValue({ error: { message: "private details" } });
  render(localized(true));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(replace).not.toHaveBeenCalled();
  expect(screen.queryByText("private details")).toBeNull();
});
it("gates registration and reset controls on email delivery", () => {
  render(localized(true));
  expect(screen.queryByRole("button", { name: "Sign up" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Forgot password" })).toBeNull();
});
it("registers without navigating before email verification", async () => {
  signup.mockResolvedValue({ data: { user: {} } });
  render(localized(true, "en", true));
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New resident" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "valid-password-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  await waitFor(() =>
    expect(signup).toHaveBeenCalledWith({
      name: "New resident",
      email: "new@example.test",
      password: "valid-password-123",
      callbackURL: "/auth?next=%2Fdirectory",
    }),
  );
  expect(screen.getByRole("status").textContent).toBe(translate("en", "authVerifySent"));
  expect(replace).not.toHaveBeenCalled();
});
it("requests a reset with a fixed destination and an enumeration-safe message", async () => {
  reset.mockResolvedValue({ data: { status: true } });
  render(localized(true, "en", true));
  fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "unknown@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
  await waitFor(() =>
    expect(reset).toHaveBeenCalledWith({
      email: "unknown@example.test",
      redirectTo: "/reset-password",
    }),
  );
  expect(screen.getByRole("status").textContent).toBe(translate("en", "authResetSent"));
});
