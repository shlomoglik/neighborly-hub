import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../../drizzle/schema";
import { sendAuthEmail } from "./email";
import type { AuthConfig } from "./config";

/** No role or resident access is inferred from a provider profile or matching email. */
export function createAuth(db: PostgresJsDatabase<typeof schema>, config: AuthConfig) {
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
    socialProviders: {
      ...(config.googleClientId && config.googleClientSecret
        ? { google: { clientId: config.googleClientId, clientSecret: config.googleClientSecret } }
        : {}),
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: !config.mail,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      ...(config.mail
        ? {
            sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) =>
              sendAuthEmail(config.mail!, user.email, url, "reset"),
          }
        : {}),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      ...(config.mail
        ? {
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { email: string };
              url: string;
            }) => sendAuthEmail(config.mail!, user.email, url, "verify"),
          }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/link-social") return;
        const session = await getSessionFromCtx(ctx);
        if (!session) throw new APIError("UNAUTHORIZED", { message: "Authentication required" });
        const age = Date.now() - new Date(session.session.createdAt).getTime();
        if (!session.user.emailVerified || !Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000)
          throw new APIError("FORBIDDEN", {
            message: "Verify your email and sign in again before linking",
          });
        if (ctx.body?.provider !== "google")
          throw new APIError("BAD_REQUEST", { message: "Unsupported provider" });
      }),
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
        trustedProviders: [],
      },
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
