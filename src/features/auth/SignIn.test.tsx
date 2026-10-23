// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "../../lib/i18n/context";
import { translate, directionFor, type Lang } from "../../lib/i18n/dictionary";
const { social, email, signUp, requestPasswordReset, signOut, replace, refresh } = vi.hoisted(
  () => ({
    social: vi.fn(),
    email: vi.fn(),
    signUp: vi.fn(),
    requestPasswordReset: vi.fn(),
    signOut: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
);
vi.mock("./client", () => ({
  authClient: {
    signIn: { social, email },
    signUp: { email: signUp },
    requestPasswordReset,
    signOut,
  },
}));
import { SignIn } from "./SignIn";
import { SignOut } from "./SignOut";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
function localized(enabled: boolean, lang: Lang = "en", returnTo?: string) {
  return (
    <I18nContext.Provider
      value={{
        lang,
        dir: directionFor(lang),
        setLang: () => {},
        t: (key, vars) => translate(lang, key, vars),
      }}
    >
      <SignIn enabled={enabled} emailDeliveryEnabled returnTo={returnTo} />
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

it("signs in with normalized email and preserves invitation destinations", async () => {
  email.mockResolvedValue({ data: { user: {} } });
  const destination = `/join/${"a".repeat(64)}`;
  render(localized(true, "en", destination));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Resident@Example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password-long-enough" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
  await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
  expect(email).toHaveBeenCalledWith({
    email: "resident@example.test",
    password: "password-long-enough",
  });
  expect(refresh).toHaveBeenCalled();
});
it("registers without navigating before verification and hides backend details", async () => {
  signUp.mockResolvedValue({ data: { user: {} } });
  render(localized(true));
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Resident" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "resident@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password-long-enough" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Sign up" }).closest("form")!);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(translate("en", "authVerifyNotice")),
  );
  expect(replace).not.toHaveBeenCalled();
  expect(signUp).toHaveBeenCalledWith({
    name: "Resident",
    email: "resident@example.test",
    password: "password-long-enough",
    callbackURL: "/directory",
  });
});
it("uses a generic recovery confirmation without revealing account existence", async () => {
  requestPasswordReset.mockResolvedValue({ data: { status: true } });
  render(localized(true));
  fireEvent.click(screen.getByRole("button", { name: "Forgot password" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "resident@example.test" } });
  fireEvent.submit(screen.getByRole("button", { name: "Send reset link" }).closest("form")!);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(translate("en", "authResetNotice")),
  );
  expect(requestPasswordReset).toHaveBeenCalledWith({
    email: "resident@example.test",
    redirectTo: "/reset-password",
  });
});
it("does not navigate on invalid credentials and prevents duplicate email submissions", async () => {
  let resolve!: (value: unknown) => void;
  email.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  render(localized(true));
  const form = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(email).toHaveBeenCalledTimes(1);
  resolve({ error: { message: "private-database-detail" } });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(translate("en", "authFailed")),
  );
  expect(replace).not.toHaveBeenCalled();
  expect(screen.queryByText("private-database-detail")).toBeNull();
});
