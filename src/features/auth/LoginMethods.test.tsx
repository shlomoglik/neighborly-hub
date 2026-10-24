// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
const { linkSocial, sendVerificationEmail } = vi.hoisted(() => ({
  linkSocial: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));
vi.mock("./client", () => ({ authClient: { linkSocial, sendVerificationEmail } }));
import { LoginMethods } from "./LoginMethods";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function mount(props: Partial<React.ComponentProps<typeof LoginMethods>> = {}) {
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <LoginMethods
        hasGoogle={false}
        hasPassword={true}
        googleEnabled
        emailVerified
        emailDeliveryEnabled
        email="user@example.test"
        initialError={false}
        {...props}
      />
    </I18nContext.Provider>,
  );
}
it("shows connected methods without offering to reconnect Google", () => {
  mount({ hasGoogle: true });
  expect(screen.getByText("Google account: Connected")).toBeTruthy();
  expect(screen.getByText("Email and password: Connected")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
it("starts explicit linking with fixed account callbacks and no sign-in call", async () => {
  linkSocial.mockResolvedValue({ data: { redirect: true } });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Connect Google to this account" }));
  await waitFor(() =>
    expect(linkSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/account?error=link",
      loginHint: "user@example.test",
    }),
  );
});
it("requires email verification before showing the link control", async () => {
  sendVerificationEmail.mockResolvedValue({ data: { status: true } });
  mount({ emailVerified: false });
  expect(screen.queryByRole("button", { name: "Connect Google to this account" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send verification email" }));
  await waitFor(() =>
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "user@example.test",
      callbackURL: "/account",
    }),
  );
  expect(linkSocial).not.toHaveBeenCalled();
});
it("hides unavailable provider controls", () => {
  mount({ googleEnabled: false, emailDeliveryEnabled: false, emailVerified: false });
  expect(screen.queryByRole("button")).toBeNull();
});
it("sanitizes callback and API errors and allows retry", async () => {
  linkSocial.mockResolvedValue({ error: { message: "private provider details" } });
  mount({ initialError: true });
  expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Connect Google to this account" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByText("private provider details")).toBeNull();
  expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
});
