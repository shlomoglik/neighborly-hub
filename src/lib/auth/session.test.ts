import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { getSession, getAuth, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAuth: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("./server", () => ({ getAuth }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: "signed-session" }) }));
vi.mock("next/navigation", () => ({ redirect }));
import { getCurrentUser, requireCurrentUser } from "./session";
beforeEach(() => {
  vi.resetAllMocks();
  getAuth.mockResolvedValue({ api: { getSession } });
  redirect.mockImplementation(() => {
    throw new Error("redirected");
  });
});
describe("server session boundary", () => {
  it("returns null when auth is disabled or the session is absent", async () => {
    getAuth.mockResolvedValueOnce(null);
    expect(await getCurrentUser(new Headers())).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
    getSession.mockResolvedValueOnce(null);
    expect(await getCurrentUser(new Headers())).toBeNull();
  });
  it("passes only request headers to the verifier and strips session/provider secrets", async () => {
    const headers = new Headers({ cookie: "signed-session", "x-user-id": "attacker-controlled" });
    getSession.mockResolvedValue({
      user: {
        id: "verified-user",
        email: "self@example.test",
        name: "Resident",
        image: "private-avatar",
      },
      session: { token: "private-session", id: "private-id" },
      account: { accessToken: "private-oauth-token" },
    });
    expect(await getCurrentUser(headers)).toEqual({
      id: "verified-user",
      email: "self@example.test",
      name: "Resident",
    });
    expect(getSession).toHaveBeenCalledWith({ headers });
  });
  it("redirects unauthenticated protected pages instead of rendering content", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireCurrentUser()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/auth");
  });
  it("propagates database/verifier failures without granting access", async () => {
    getSession.mockRejectedValue(new Error("database unavailable"));
    await expect(getCurrentUser(new Headers())).rejects.toThrow("database unavailable");
  });
});
