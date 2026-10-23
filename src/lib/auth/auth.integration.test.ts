import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, sql as query } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";
import { createAuth } from "./create-auth";

// Only an explicitly provided disposable test database may run these fixtures.
const url = process.env.AUTH_TEST_DATABASE_URL;
const config = {
  baseURL: "https://neighborly.test",
  secret: "auth-integration-only-secret-2dc860874b8f4b62a852",
  googleClientId: "test-google-client",
  googleClientSecret: "test-google-secret",
};
function setup(databaseURL: string) {
  const client = postgres(databaseURL, { max: 1 });
  const db = drizzle(client, { schema });
  // Privileged fixture helpers are only added to this test instance, never production.
  const options = createAuth(db, {
    ...config,
    mail: { apiKey: "test-only", from: "auth@example.test" },
  }).options;
  const messages: { kind: "verify" | "reset"; url: string }[] = [];
  const auth = betterAuth({
    ...options,
    emailVerification: {
      ...options.emailVerification,
      sendVerificationEmail: async ({ url }) => {
        messages.push({ kind: "verify", url });
      },
    },
    emailAndPassword: {
      ...options.emailAndPassword,
      sendResetPassword: async ({ url }) => {
        messages.push({ kind: "reset", url });
      },
    },
    plugins: [testUtils()],
  });
  return { client, db, auth, messages };
}
describe.skipIf(!url)("PostgreSQL auth sessions", () => {
  let fixture: ReturnType<typeof setup>;
  const userIds: string[] = [];
  const verificationIds: string[] = [];
  beforeAll(() => {
    fixture = setup(url!);
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      if (userIds.length)
        await fixture.db.delete(schema.appUsers).where(inArray(schema.appUsers.id, userIds));
      if (verificationIds.length)
        await fixture.db
          .delete(schema.authVerifications)
          .where(inArray(schema.authVerifications.id, verificationIds));
    } finally {
      await fixture.client.end();
    }
  });
  async function login() {
    const test = (await fixture.auth.$context).test;
    const user = await test.saveUser(
      test.createUser({
        id: crypto.randomUUID(),
        email: `auth-${crypto.randomUUID()}@example.test`,
        name: "Auth fixture",
        emailVerified: true,
      }),
    );
    userIds.push(user.id);
    return test.login({ userId: user.id });
  }
  function request(path: string, body?: object, headers?: HeadersInit) {
    return fixture.auth.handler(
      new Request(`${config.baseURL}/api/auth${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          origin: config.baseURL,
          ...(body ? { "content-type": "application/json" } : {}),
          ...Object.fromEntries(new Headers(headers)),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }
  it("maps the verified session to the existing app_users UUID without granting roles", async () => {
    const signed = await login();
    const session = await fixture.auth.api.getSession({ headers: signed.headers });
    expect(session?.user.id).toBe(signed.user.id);
    const [row] = await fixture.db
      .select()
      .from(schema.appUsers)
      .where(eq(schema.appUsers.id, signed.user.id));
    expect(row.displayName).toBe("Auth fixture");
    expect(row.emailVerified).toBe(true);
    expect(
      await fixture.db
        .select()
        .from(schema.globalRoles)
        .where(eq(schema.globalRoles.userId, row.id)),
    ).toEqual([]);
    expect(
      await fixture.db
        .select()
        .from(schema.staffAssignments)
        .where(eq(schema.staffAssignments.userId, row.id)),
    ).toEqual([]);
    expect(signed.cookies[0]).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
  });
  it("rejects absent cookies, forged IDs and unsigned session tokens", async () => {
    const signed = await login();
    expect(
      await fixture.auth.api.getSession({ headers: new Headers({ "x-user-id": signed.user.id }) }),
    ).toBeNull();
    const cookieName = signed.cookies[0].name;
    expect(
      await fixture.auth.api.getSession({
        headers: new Headers({ cookie: `${cookieName}=${signed.token}` }),
      }),
    ).toBeNull();
    expect(
      await fixture.auth.api.getSession({
        headers: new Headers({ cookie: `${cookieName}=tampered.token` }),
      }),
    ).toBeNull();
  });
  it("rejects expired sessions", async () => {
    const signed = await login();
    await fixture.db
      .update(schema.authSessions)
      .set({ expiresAt: new Date(Date.now() - 60000) })
      .where(eq(schema.authSessions.token, signed.token));
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).toBeNull();
  });
  it("rejects a revoked session even after the cookie authenticated successfully", async () => {
    const signed = await login();
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).not.toBeNull();
    await fixture.db.delete(schema.authSessions).where(eq(schema.authSessions.token, signed.token));
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).toBeNull();
  });
  it("signs out through the real handler and revokes the database session", async () => {
    const signed = await login();
    const response = await request("/sign-out", {}, signed.headers);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).toBeNull();
  });
  it("rejects a foreign-origin sign-out without revoking the valid session", async () => {
    const signed = await login();
    const headers = new Headers(signed.headers);
    headers.set("origin", "https://attacker.test");
    const response = await request("/sign-out", {}, headers);
    expect(response.status).toBe(403);
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).not.toBeNull();
  });
  it("starts Google OAuth with the exact callback and rejects external success destinations", async () => {
    const existing = new Set(
      (
        await fixture.db.select({ id: schema.authVerifications.id }).from(schema.authVerifications)
      ).map((row) => row.id),
    );
    const response = await request("/sign-in/social", {
      provider: "google",
      callbackURL: "/account",
      disableRedirect: true,
    });
    for (const record of await fixture.db
      .select({ id: schema.authVerifications.id })
      .from(schema.authVerifications))
      if (!existing.has(record.id)) verificationIds.push(record.id);
    expect(response.status).toBe(200);
    const result = await response.json();
    const oauth = new URL(result.url);
    expect(oauth.hostname).toBe("accounts.google.com");
    expect(oauth.searchParams.get("redirect_uri")).toBe(
      `${config.baseURL}/api/auth/callback/google`,
    );
    expect(oauth.searchParams.get("state")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const unsafe = await request("/sign-in/social", {
      provider: "google",
      callbackURL: "https://attacker.test/steal",
    });
    expect(unsafe.status).toBeGreaterThanOrEqual(400);
    expect(unsafe.status).toBeLessThan(500);
  });
  it("rejects an OAuth callback without valid state before creating a user", async () => {
    const before = await fixture.db
      .select({ count: query<number>`count(*)::int` })
      .from(schema.appUsers);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected external OAuth request"));
    let response: Response;
    try {
      response = await request("/callback/google?state=forged&code=untrusted");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(
      await fixture.db.select({ count: query<number>`count(*)::int` }).from(schema.appUsers),
    ).toEqual(before);
  });
  it("registers unprivileged accounts, hashes passwords, requires verification and authenticates afterward", async () => {
    const email = `password-${crypto.randomUUID()}@example.test`;
    const password = "initial-strong-password-123";
    const response = await request("/sign-up/email", { name: "Password fixture", email, password });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    const [user] = await fixture.db
      .select()
      .from(schema.appUsers)
      .where(eq(schema.appUsers.email, email));
    userIds.push(user.id);
    expect(user.emailVerified).toBe(false);
    const [account] = await fixture.db
      .select()
      .from(schema.authAccounts)
      .where(eq(schema.authAccounts.userId, user.id));
    expect(account.providerId).toBe("credential");
    expect(account.password).toBeTruthy();
    expect(account.password).not.toBe(password);
    expect(
      await fixture.db
        .select()
        .from(schema.globalRoles)
        .where(eq(schema.globalRoles.userId, user.id)),
    ).toEqual([]);
    expect(
      await fixture.db
        .select()
        .from(schema.staffAssignments)
        .where(eq(schema.staffAssignments.userId, user.id)),
    ).toEqual([]);
    expect((await request("/sign-in/email", { email, password })).status).toBe(403);
    const verificationURL = fixture.messages.findLast((message) => message.kind === "verify")!.url;
    expect((await fixture.auth.handler(new Request(verificationURL))).status).toBeLessThan(400);
    const signed = await request("/sign-in/email", { email, password });
    expect(signed.status).toBe(200);
    expect((await signed.json()).user.id).toBe(user.id);
    expect(signed.headers.get("set-cookie")).toContain("HttpOnly");
    const incorrect = await request("/sign-in/email", { email, password: "incorrect-password" });
    const unknown = await request("/sign-in/email", {
      email: `unknown-${crypto.randomUUID()}@example.test`,
      password,
    });
    expect(incorrect.status).toBe(401);
    expect(await incorrect.json()).toEqual(await unknown.json());
    const duplicate = await request("/sign-up/email", {
      name: "Attacker",
      email,
      password: "attacker-password-123",
    });
    expect(duplicate.status).toBe(200);
    expect(
      (await request("/sign-in/email", { email, password: "attacker-password-123" })).status,
    ).toBe(401);
  });
  it("adds a password to the same authenticated Google identity without replacing credentials", async () => {
    const signed = await login();
    const password = "existing-google-password-123";
    await fixture.db
      .insert(schema.authAccounts)
      .values({
        id: crypto.randomUUID(),
        userId: signed.user.id,
        providerId: "google",
        accountId: crypto.randomUUID(),
      });
    await expect(
      fixture.auth.api.setPassword({ body: { newPassword: password }, headers: new Headers() }),
    ).rejects.toThrow();
    await fixture.auth.api.setPassword({
      body: { newPassword: password },
      headers: signed.headers,
    });
    await expect(
      fixture.auth.api.setPassword({
        body: { newPassword: "replacement-password-123" },
        headers: signed.headers,
      }),
    ).rejects.toThrow();
    const response = await request("/sign-in/email", { email: signed.user.email, password });
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe(signed.user.id);
    expect(
      await fixture.db
        .select()
        .from(schema.authAccounts)
        .where(eq(schema.authAccounts.userId, signed.user.id)),
    ).toHaveLength(2);
    // Public registration cannot claim the existing authenticated identity.
    expect(
      (
        await request("/sign-up/email", {
          name: "Attacker",
          email: signed.user.email,
          password: "attacker-password-123",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/sign-in/email", {
          email: signed.user.email,
          password: "attacker-password-123",
        })
      ).status,
    ).toBe(401);
    await request("/request-password-reset", {
      email: signed.user.email,
      redirectTo: "/reset-password",
    });
    const resetURL = fixture.messages.findLast((message) => message.kind === "reset")!.url;
    const token = new URL(resetURL).pathname.split("/").at(-1)!;
    expect(
      (await request("/reset-password", { token, newPassword: "reset-strong-password-123" }))
        .status,
    ).toBe(200);
    expect(await fixture.auth.api.getSession({ headers: signed.headers })).toBeNull();
    expect(
      (await request("/reset-password", { token, newPassword: "reuse-strong-password-123" }))
        .status,
    ).toBeGreaterThanOrEqual(400);
    expect((await request("/sign-in/email", { email: signed.user.email, password })).status).toBe(
      401,
    );
    expect(
      (
        await request("/sign-in/email", {
          email: signed.user.email,
          password: "reset-strong-password-123",
        })
      ).status,
    ).toBe(200);
  });
  it("rejects weak passwords and foreign-origin credential requests", async () => {
    expect(
      (
        await request("/sign-up/email", {
          name: "Weak",
          email: `weak-${crypto.randomUUID()}@example.test`,
          password: "short",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await request(
          "/sign-in/email",
          { email: "someone@example.test", password: "strong-password-123" },
          { origin: "https://attacker.test" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/request-password-reset", {
          email: "someone@example.test",
          redirectTo: "https://attacker.test",
        })
      ).status,
    ).toBe(403);
  });
});
