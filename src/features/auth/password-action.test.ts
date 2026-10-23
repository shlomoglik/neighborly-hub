import { afterEach, expect, it, vi } from "vitest";
const { getAuth, getSession, setPassword } = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getSession: vi.fn(),
  setPassword: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ getAuth }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "signed-session" }) }));
import { setAccountPassword } from "./password-action";
afterEach(() => vi.resetAllMocks());
it("requires an authenticated, verified identity and validates password bounds", async () => {
  getAuth.mockResolvedValue({ api: { getSession, setPassword } });
  for (const user of [null, { user: { emailVerified: false } }]) {
    getSession.mockResolvedValue(user);
    expect(await setAccountPassword("new-long-password")).toBe(false);
  }
  expect(await setAccountPassword("short")).toBe(false);
  expect(await setAccountPassword("a".repeat(129))).toBe(false);
  expect(setPassword).not.toHaveBeenCalled();
});
it("delegates to the library API and handles an already-set password safely", async () => {
  getAuth.mockResolvedValue({ api: { getSession, setPassword } });
  getSession.mockResolvedValue({
    user: { emailVerified: true },
    session: { createdAt: new Date() },
  });
  setPassword.mockResolvedValue({ status: true });
  expect(await setAccountPassword("new-long-password")).toBe(true);
  expect(setPassword).toHaveBeenCalledWith({
    headers: expect.any(Headers),
    body: { newPassword: "new-long-password" },
  });
  setPassword.mockRejectedValue(new Error("PASSWORD_ALREADY_SET"));
  expect(await setAccountPassword("another-long-password")).toBe(false);
});

it("requires authentication within five minutes before adding a password", async () => {
  getAuth.mockResolvedValue({ api: { getSession, setPassword } });
  getSession.mockResolvedValue({
    user: { emailVerified: true },
    session: { createdAt: new Date(Date.now() - 6 * 60000) },
  });
  expect(await setAccountPassword("new-long-password")).toBe(false);
  expect(setPassword).not.toHaveBeenCalled();
});
