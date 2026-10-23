import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, sql as query } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";
import { createAuth } from "./create-auth";

// Only an explicitly provided disposable test database may run these fixtures.
const { messages } = vi.hoisted(() => ({
  messages: [] as { recipient: string; url: string; kind: string }[],
}));
vi.mock("./email", () => ({
  sendAuthEmail: async (_delivery: unknown, recipient: string, url: string, kind: string) => {
    messages.push({ recipient, url, kind });
  },
}));
const url = process.env.AUTH_TEST_DATABASE_URL;
const config = {
  baseURL: "https://neighborly.test",
  secret: "auth-integration-only-secret-2dc860874b8f4b62a852",
  googleClientId: "test-google-client",
  googleClientSecret: "test-google-secret",
  emailDelivery: { apiKey: "test-key", from: "auth@example.test" },
};
function setup(databaseURL: string) {
  const client = postgres(databaseURL, { max: 1 });
  const db = drizzle(client, { schema });
  // Privileged fixture helpers are only added to this test instance, never production.
  const auth = betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] });
  return { client, db, auth };
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
  it("verifies email before password login, preserves identity and revokes sessions after reset", async () => {
    const email = `password-${crypto.randomUUID()}@example.test`;
    const password = "initial-long-password";
    const signup = await request("/sign-up/email", {
      name: "Password resident",
      email,
      password,
      callbackURL: "/directory",
    });
    expect(signup.status).toBe(200);
    expect(signup.headers.get("set-cookie") ?? "").not.toContain("session_token=");
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
    expect((await request("/sign-in/email", { email, password })).status).toBe(403);
    const verification = messages.findLast(
      (message) => message.recipient === email && message.kind === "verify",
    )!;
    expect(verification).toBeTruthy();
    const verified = await fixture.auth.handler(new Request(verification.url));
    expect(verified.status).toBeLessThan(400);
    expect(
      (await request("/sign-in/email", { email, password: "wrong-long-password" })).status,
    ).toBe(401);
    const signed = await request("/sign-in/email", { email, password });
    expect(signed.status).toBe(200);
    const sessionCookie = signed.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const sessionHeaders = new Headers({ cookie: sessionCookie });
    expect((await fixture.auth.api.getSession({ headers: sessionHeaders }))?.user.id).toBe(user.id);
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
    const duplicate = await request("/sign-up/email", {
      name: "Attacker",
      email,
      password: "different-long-password",
    });
    expect(duplicate.status).toBe(200);
    const reset = await request("/request-password-reset", {
      email,
      redirectTo: "/reset-password",
    });
    const unknown = await request("/request-password-reset", {
      email: `absent-${crypto.randomUUID()}@example.test`,
      redirectTo: "/reset-password",
    });
    expect(reset.status).toBe(unknown.status);
    expect(await reset.json()).toEqual(await unknown.json());
    const recovery = messages.findLast(
      (message) => message.recipient === email && message.kind === "reset",
    )!;
    const token = new URL(recovery.url).pathname.split("/").at(-1)!;
    const resetResult = await request("/reset-password", {
      token,
      newPassword: "replacement-long-password",
    });
    expect(resetResult.status).toBe(200);
    expect(await fixture.auth.api.getSession({ headers: sessionHeaders })).toBeNull();
    expect(
      (await request("/reset-password", { token, newPassword: "reused-token-password" })).status,
    ).toBeGreaterThanOrEqual(400);
    expect((await request("/sign-in/email", { email, password })).status).toBe(401);
    expect(
      (await request("/sign-in/email", { email, password: "replacement-long-password" })).status,
    ).toBe(200);
  });
  it("lets a fresh Google identity add a password without linking by email or replacing a password", async () => {
    const signed = await login();
    await fixture.db
      .insert(schema.authAccounts)
      .values({ userId: signed.user.id, providerId: "google", accountId: crypto.randomUUID() });
    await expect(
      fixture.auth.api.setPassword({
        headers: signed.headers,
        body: { newPassword: "new-google-password" },
      }),
    ).resolves.toMatchObject({ status: true });
    await expect(
      fixture.auth.api.setPassword({
        headers: signed.headers,
        body: { newPassword: "replacement-password" },
      }),
    ).rejects.toThrow();
    expect(
      (
        await request("/sign-in/email", {
          email: signed.user.email,
          password: "new-google-password",
        })
      ).status,
    ).toBe(200);
  });
  it("rejects weak passwords and foreign-origin signup without creating accounts", async () => {
    const email = `blocked-${crypto.randomUUID()}@example.test`;
    expect(
      (await request("/sign-up/email", { name: "Blocked", email, password: "short" })).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await request(
          "/sign-up/email",
          { name: "Blocked", email, password: "valid-long-password" },
          { origin: "https://attacker.test" },
        )
      ).status,
    ).toBe(403);
    expect(
      await fixture.db.select().from(schema.appUsers).where(eq(schema.appUsers.email, email)),
    ).toEqual([]);
  });
});
