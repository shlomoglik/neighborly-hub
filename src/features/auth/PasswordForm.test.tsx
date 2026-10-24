// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "@/lib/i18n/context";
import { translate } from "@/lib/i18n/dictionary";
const { setPassword, changePassword, resetPassword } = vi.hoisted(() => ({
  setPassword: vi.fn(),
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("./set-password", () => ({ setAccountPassword: setPassword }));
vi.mock("./client", () => ({ authClient: { changePassword, resetPassword } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { PasswordForm } from "./PasswordForm";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function mount(mode: "set" | "change" | "reset", token?: string) {
  return render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      <PasswordForm mode={mode} token={token} />
    </I18nContext.Provider>,
  );
}
function fill(confirm = "strong-password-123") {
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "strong-password-123" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
}
it("does not submit mismatching passwords", () => {
  mount("set");
  fill("another-password-123");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("alert").textContent).toBe(translate("en", "authPasswordMismatch"));
  expect(setPassword).not.toHaveBeenCalled();
});
it("sets the first password and clears the form after success", async () => {
  setPassword.mockResolvedValue(true);
  mount("set");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
  expect(setPassword).toHaveBeenCalledWith("strong-password-123");
  expect(screen.queryByLabelText("New password")).toBeNull();
});
it("requires the current password and revokes other sessions when changing credentials", async () => {
  changePassword.mockResolvedValue({ data: { user: {} } });
  mount("change");
  fill();
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "current-password-123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "current-password-123",
      newPassword: "strong-password-123",
      revokeOtherSessions: true,
    }),
  );
});
it("uses the recovery token and allows retry after a sanitized error", async () => {
  resetPassword.mockResolvedValue({ error: { message: "private token detail" } });
  mount("reset", "recovery-token");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(resetPassword).toHaveBeenCalledWith({
    newPassword: "strong-password-123",
    token: "recovery-token",
  });
  expect(screen.queryByText("private token detail")).toBeNull();
  expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(false);
});
