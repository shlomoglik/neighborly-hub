import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../../drizzle/schema";
import { sendAuthEmail } from "./email";
import type { AuthConfig } from "./config";

/** No role or resident access is inferred from a provider profile or matching email. */
export function createAuth(db: PostgresJsDatabase<typeof schema>, config: AuthConfig) {
  const delivery = config.emailDelivery;
  return betterAuth({
    appName: "Neighborly Hub",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.appUsers,
        session: schema.authSessions,
        account: schema.authAccounts,
        verification: schema.authVerifications,
      },
      transaction: true,
    }),
    user: {
      fields: { name: "displayName" },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    socialProviders:
      config.googleClientId && config.googleClientSecret
        ? {
            google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret },
          }
        : {},
    emailAndPassword: {
      enabled: true,
      disableSignUp: !delivery,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      ...(delivery
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
              await sendAuthEmail(delivery, user.email, url, "reset");
            },
          }
        : {}),
    },
    emailVerification: {
      sendOnSignUp: Boolean(delivery),
      sendOnSignIn: Boolean(delivery),
      ...(delivery
        ? {
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => {
              await sendAuthEmail(delivery, user.email, url, "verify");
            },
          }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: { enabled: false, disableImplicitLinking: true },
      storeStateStrategy: "database",
    },
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      // The library otherwise skips origin checks in test environments.
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
    rateLimit: { enabled: true },
    telemetry: { enabled: false },
  });
}
export type Auth = ReturnType<typeof createAuth>;
