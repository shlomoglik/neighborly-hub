// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nContext } from "../../lib/i18n/context";
import { translate } from "../../lib/i18n/dictionary";
const { setAccountPassword, changePassword, resetPassword } = vi.hoisted(() => ({
  setAccountPassword: vi.fn(),
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("./password-action", () => ({ setAccountPassword }));
vi.mock("./client", () => ({ authClient: { changePassword, resetPassword } }));
import { AccountPassword } from "./AccountPassword";
import { ResetPassword } from "./ResetPassword";
function show(child: React.ReactNode) {
  render(
    <I18nContext.Provider
      value={{
        lang: "en",
        dir: "ltr",
        setLang: () => {},
        t: (key, vars) => translate("en", key, vars),
      }}
    >
      {child}
    </I18nContext.Provider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("adds the first password and then requires the current password for changes", async () => {
  setAccountPassword.mockResolvedValue(true);
  changePassword.mockResolvedValue({ data: { user: {} } });
  show(<AccountPassword hasPassword={false} />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "initial-long-password" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
  await waitFor(() => expect(screen.getByLabelText("Password")).toBeTruthy());
  expect(setAccountPassword).toHaveBeenCalledWith("initial-long-password");
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "initial-long-password" },
  });
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "updated-long-password" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
  await waitFor(() =>
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "initial-long-password",
      newPassword: "updated-long-password",
      revokeOtherSessions: true,
    }),
  );
});
it("requires a reset token and sends it only to the library reset API", async () => {
  show(<ResetPassword />);
  expect(screen.getByRole("alert").textContent).toBe(translate("en", "authResetFailed"));
  expect(screen.queryByRole("button")).toBeNull();
  cleanup();
  resetPassword.mockResolvedValue({ data: { status: true } });
  show(<ResetPassword token="single-use-token" />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "reset-long-password" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(translate("en", "authPasswordSaved")),
  );
  expect(resetPassword).toHaveBeenCalledWith({
    token: "single-use-token",
    newPassword: "reset-long-password",
  });
});
