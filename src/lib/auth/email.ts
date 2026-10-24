import type { AuthConfig } from "./config";

/** Never log provider responses: they may contain addresses or recovery links. */
export async function sendAuthEmail(
  delivery: NonNullable<AuthConfig["mail"]>,
  recipient: string,
  url: string,
  kind: "verify" | "reset",
) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${delivery.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Neighborly-Hub",
      },
      body: JSON.stringify({
        from: delivery.from,
        to: [recipient],
        subject:
          kind === "verify"
            ? "Neighborly Hub — Verify your email / אימות אימייל"
            : "Neighborly Hub — Reset your password / איפוס סיסמה",
        text: `${kind === "verify" ? "Verify your email / לאימות האימייל" : "Reset your password / לאיפוס הסיסמה"}:
${url}

If you did not request this, ignore this message. / אם לא ביקשת זאת, אפשר להתעלם מההודעה.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Delivery failed");
  } catch {
    throw new Error("Authentication email delivery failed");
  }
}
