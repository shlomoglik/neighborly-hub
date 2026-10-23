import type { AuthConfig } from "./config";

/** Never log provider responses: they may contain addresses or recovery links. */
export async function sendAuthEmail(
  delivery: NonNullable<AuthConfig["emailDelivery"]>,
  recipient: string,
  url: string,
  kind: "verify" | "reset",
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${delivery.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: delivery.from,
      to: [recipient],
      subject:
        kind === "verify"
          ? "Neighborly Hub — Verify your email / אימות אימייל"
          : "Neighborly Hub — Reset your password / איפוס סיסמה",
      text: `${kind === "verify" ? "Verify your email / לאימות האימייל" : "Reset your password / לאיפוס הסיסמה"}:\n${url}\n\nIf you did not request this, ignore this message. / אם לא ביקשת זאת, אפשר להתעלם מההודעה.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Authentication email delivery failed");
}
