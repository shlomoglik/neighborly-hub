import { z } from "zod";

const keys = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"] as const;
const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
});
export type AuthConfig = {
  baseURL: string;
  secret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  mail?: { apiKey: string; from: string };
};
/** Missing configuration disables auth. Invalid complete configuration fails closed. */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  if (keys.some((key) => !env[key])) return null;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== "")),
  );
  if (!parsed.success) throw new Error("Authentication configuration is invalid");
  const data = parsed.data;
  const url = new URL(data.BETTER_AUTH_URL);
  const localHTTP =
    env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (!localHTTP && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Authentication requires a trusted HTTPS origin (HTTP localhost is allowed in development)",
    );
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET || undefined;
  const apiKey = env.RESEND_API_KEY?.trim() || undefined;
  const from = env.AUTH_EMAIL_FROM?.trim() || undefined;
  if (Boolean(googleClientId) !== Boolean(googleClientSecret) || Boolean(apiKey) !== Boolean(from))
    throw new Error("Authentication configuration is invalid");
  if (from && !z.string().email().safeParse(from).success)
    throw new Error("Authentication email sender must be an email address");
  return {
    baseURL: url.origin,
    secret: data.BETTER_AUTH_SECRET,
    googleClientId,
    googleClientSecret,
    mail: apiKey && from ? { apiKey, from } : undefined,
  };
}
