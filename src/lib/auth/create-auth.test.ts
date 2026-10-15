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
});
