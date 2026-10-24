import { expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../../drizzle/schema";
import { createAuth } from "./create-auth";

it("initializes the existing app_users adapter and secure cookie settings without a database connection", async () => {
  const auth = createAuth(drizzle.mock({ schema }), {
    baseURL: "https://neighborly.test",
    secret: "schema-check-only-secret-059a6e479f0f4788",
    googleClientId: "test-client",
    googleClientSecret: "test-secret",
  });
  const context = await auth.$context;
  expect(context.authCookies.sessionToken.attributes).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
  expect(context.trustedOrigins).toContain("https://neighborly.test");
  expect("test" in context).toBe(false);
  expect(context.skipOriginCheck).toBe(false);
  expect(context.skipCSRFCheck).toBe(false);
});

it("enables verified credential login while gating public registration on email delivery", () => {
  const config = {
    baseURL: "https://neighborly.test",
    secret: "only-for-tests-32-characters-long-secret",
  };
  const auth = createAuth(drizzle.mock({ schema }), config);
  expect(auth.options.emailAndPassword).toMatchObject({
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  });
  expect(auth.options.socialProviders).toEqual({});
  expect(auth.options.rateLimit?.enabled).toBe(true);
  expect(auth.options.account?.accountLinking).toMatchObject({
    enabled: true,
    disableImplicitLinking: true,
    allowDifferentEmails: false,
    trustedProviders: [],
  });
  const withMail = createAuth(drizzle.mock({ schema }), {
    ...config,
    mail: { apiKey: "test", from: "auth@example.test" },
  });
  expect(withMail.options.emailAndPassword?.disableSignUp).toBe(false);
  expect(withMail.options.emailVerification?.sendVerificationEmail).toBeTypeOf("function");
  expect(withMail.options.emailAndPassword?.sendResetPassword).toBeTypeOf("function");
});
