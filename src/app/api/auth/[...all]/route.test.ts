import { expect, it, vi } from "vitest";
const { getAuth } = vi.hoisted(() => ({ getAuth: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getAuth }));
import { GET, POST } from "./route";
it("disables all auth endpoints when configuration is absent", async () => {
  getAuth.mockResolvedValue(null);
  for (const handler of [GET, POST]) {
    const response = await handler(new Request("https://neighborly.example/api/auth/get-session"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AUTH_UNAVAILABLE" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
});
it("delegates the original request to the auth library without replacing security headers", async () => {
  const result = new Response("{}", {
    headers: { "set-cookie": "opaque-library-cookie; HttpOnly" },
  });
  const handler = vi.fn().mockResolvedValue(result);
  getAuth.mockResolvedValue({ handler });
  const request = new Request("https://neighborly.example/api/auth/sign-out", { method: "POST" });
  expect(await POST(request)).toBe(result);
  expect(handler).toHaveBeenCalledWith(request);
});
