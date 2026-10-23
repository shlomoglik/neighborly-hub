import { afterEach, expect, it, vi } from "vitest";
import { sendAuthEmail } from "./email";
afterEach(() => vi.unstubAllGlobals());
it("sends verification and recovery links through the configured server-only provider", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  await sendAuthEmail(
    { apiKey: "private-key", from: "auth@example.test" },
    "user@example.test",
    "https://neighborly.test/verify?token=private",
    "verify",
  );
  expect(fetch).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer private-key" }),
    }),
  );
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.to).toEqual(["user@example.test"]);
  expect(body.text).toContain("https://neighborly.test/verify?token=private");
});
it("does not expose delivery provider or network errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("private provider details", { status: 500 })),
  );
  await expect(
    sendAuthEmail(
      { apiKey: "private", from: "auth@example.test" },
      "user@example.test",
      "private-link",
      "reset",
    ),
  ).rejects.toThrow("Authentication email delivery failed");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private-key and link")));
  await expect(
    sendAuthEmail(
      { apiKey: "private", from: "auth@example.test" },
      "user@example.test",
      "private-link",
      "reset",
    ),
  ).rejects.toThrow("Authentication email delivery failed");
});
