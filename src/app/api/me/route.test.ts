import { expect, it, vi } from "vitest";
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));
import { GET } from "./route";
it("rejects anonymous API requests with an uncached 401", async () => {
  getCurrentUser.mockResolvedValue(null);
  const response = await GET(new Request("https://neighborly.example/api/me"));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "UNAUTHENTICATED" });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
});
it("returns only the current user's view model and does not cache it", async () => {
  const user = { id: "one", email: "one@example.test", name: "One" };
  getCurrentUser.mockResolvedValue(user);
  const request = new Request("https://neighborly.example/api/me?userId=other");
  const response = await GET(request);
  expect(await response.json()).toEqual({ user });
  expect(getCurrentUser).toHaveBeenLastCalledWith(request.headers);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});
