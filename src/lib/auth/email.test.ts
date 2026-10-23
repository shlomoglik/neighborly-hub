import { afterEach, expect, it, vi } from "vitest";
import { sendAuthEmail } from "./email";
afterEach(() => vi.unstubAllGlobals());
it("delivers verification and recovery links through the configured sender", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetcher);
  for (const kind of ["verify", "reset"] as const) {
    await sendAuthEmail(
      { apiKey: "secret", from: "auth@example.test" },
      "user@example.test",
      "https://neighborly.test/token",
      kind,
    );
    const [url, init] = fetcher.mock.lastCall!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body)).toMatchObject({
      from: "auth@example.test",
      to: ["user@example.test"],
      text: expect.stringContaining("https://neighborly.test/token"),
    });
    expect(init.headers.Authorization).toBe("Bearer secret");
  }
});
it("does not expose a failed provider response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("private-provider-details", { status: 400 })),
  );
  await expect(
    sendAuthEmail(
      { apiKey: "secret", from: "auth@example.test" },
      "user@example.test",
      "https://neighborly.test/token",
      "reset",
    ),
  ).rejects.toThrow("Authentication email delivery failed");
});
