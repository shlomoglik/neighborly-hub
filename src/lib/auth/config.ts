import { z } from "zod";

const keys = [
  "DATABASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;
const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol)),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});
export type AuthConfig = {
  baseURL: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
};
/** Missing configuration disables auth. Invalid complete configuration fails closed. */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  if (keys.some((key) => !env[key])) return null;
  const parsed = schema.safeParse(env);
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
  return {
    baseURL: url.origin,
    secret: data.BETTER_AUTH_SECRET,
    googleClientId: data.GOOGLE_CLIENT_ID,
    googleClientSecret: data.GOOGLE_CLIENT_SECRET,
  };
}
