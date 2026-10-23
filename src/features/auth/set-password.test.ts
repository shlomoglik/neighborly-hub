import { afterEach, expect, it, vi } from "vitest";
const { getAuth, headers } = vi.hoisted(() => ({ getAuth: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getAuth }));
vi.mock("next/headers", () => ({ headers }));
import { setAccountPassword } from "./set-password";
afterEach(() => vi.resetAllMocks());
it("requires an authenticated verified account before creating credentials", async () => {
  const setPassword = vi.fn();
  const getSession = vi.fn().mockResolvedValue(null);
  getAuth.mockResolvedValue({ api: { getSession, setPassword } });
  headers.mockResolvedValue(new Headers());
  expect(await setAccountPassword("strong-password-123")).toBe(false);
  getSession.mockResolvedValue({ user: { emailVerified: false } });
  expect(await setAccountPassword("strong-password-123")).toBe(false);
  expect(setPassword).not.toHaveBeenCalled();
});
it("passes only the current session and password to Better Auth", async () => {
  const setPassword = vi.fn().mockResolvedValue({ status: true });
  const sessionHeaders = new Headers({ cookie: "signed-session" });
  getAuth.mockResolvedValue({
    api: { getSession: vi.fn().mockResolvedValue({ user: { emailVerified: true } }), setPassword },
  });
  headers.mockResolvedValue(sessionHeaders);
  expect(await setAccountPassword("strong-password-123")).toBe(true);
  expect(setPassword).toHaveBeenCalledWith({
    headers: sessionHeaders,
    body: { newPassword: "strong-password-123" },
  });
  setPassword.mockRejectedValue(new Error("private database details"));
  expect(await setAccountPassword("strong-password-123")).toBe(false);
});
it("rejects invalid password input before initializing authentication", async () => {
  expect(await setAccountPassword("short")).toBe(false);
  expect(await setAccountPassword("a".repeat(129))).toBe(false);
  expect(getAuth).not.toHaveBeenCalled();
});
