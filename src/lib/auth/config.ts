import { z } from "zod";

const keys = ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"] as const;
const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().email().optional(),
});
export type AuthConfig = {
  baseURL: string;
  secret: string;
  googleClientId?: string;
  googleClientSecret?: string;
  emailDelivery?: { apiKey: string; from: string };
};
/** Missing configuration disables auth. Invalid complete configuration fails closed. */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  if (keys.some((key) => !env[key])) return null;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(env).filter(([, value]) => value !== "")),
  );
  if (!parsed.success) throw new Error("Authentication configuration is invalid");
  const data = parsed.data;
  if (
    Boolean(data.GOOGLE_CLIENT_ID) !== Boolean(data.GOOGLE_CLIENT_SECRET) ||
    Boolean(data.RESEND_API_KEY) !== Boolean(data.AUTH_EMAIL_FROM)
  )
    throw new Error("Authentication configuration is invalid");
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
  return {
    baseURL: url.origin,
    secret: data.BETTER_AUTH_SECRET,
    googleClientId: data.GOOGLE_CLIENT_ID,
    googleClientSecret: data.GOOGLE_CLIENT_SECRET,
    emailDelivery:
      data.RESEND_API_KEY && data.AUTH_EMAIL_FROM
        ? { apiKey: data.RESEND_API_KEY, from: data.AUTH_EMAIL_FROM }
        : undefined,
  };
}
