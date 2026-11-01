import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { submitFeedback } from "./product-feedback";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET, POST } from "@/app/api/product-feedback/route";
const config = {
  baseURL: "https://feedback.test",
  secret: "feedback-integration-only-32-character-secret",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 6 });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("Product feedback with PostgreSQL and signed sessions", () => {
  const users = Array.from({ length: 7 }, () => crypto.randomUUID());
  const [admin, resident, pending, unlinked, pm, bm, removable] = users;
  const [project, building, floor, apartment, home, person, invitation] = Array.from(
    { length: 7 },
    () => crypto.randomUUID(),
  );
  const input = () => ({ submissionId: crypto.randomUUID(), message: "Pilot feedback" });
  async function request(method: string, user?: string, body?: unknown, query = "") {
    const headers = new Headers(
      user ? (await (await fixture.auth.$context).test.login({ userId: user })).headers : undefined,
    );
    headers.set("origin", config.baseURL);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    return new Request(`${config.baseURL}/api/product-feedback${query}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({ id, email: `${id}@example.test`, name: "Private fixture" }),
      );
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.globalRoles).values({ userId: admin, role: "admin" });
      await tx.insert(s.projects).values({ id: project, name: "Feedback fixture" });
      await tx.insert(s.buildings).values({ id: building, projectId: project, name: "A" });
      await tx.insert(s.floors).values({ id: floor, buildingId: building, number: 1 });
      await tx
        .insert(s.apartments)
        .values({ id: apartment, buildingId: building, floorId: floor, number: "1" });
      await tx.insert(s.parties).values({ id: person, kind: "person" });
      await tx.insert(s.people).values({ partyId: person, fullName: "Resident" });
      await tx
        .insert(s.userPersonLinks)
        .values({ userId: resident, personId: person, verifiedBy: admin });
      await tx.insert(s.households).values({
        id: home,
        apartmentId: apartment,
        displayName: "Home",
        approvalStatus: "approved",
      });
      await tx.insert(s.householdMembers).values({ householdId: home, personId: person });
      await tx.insert(s.staffAssignments).values([
        { userId: pm, projectId: project, role: "project_manager" },
        { userId: bm, projectId: project, buildingId: building, role: "building_manager" },
      ]);
      await tx.insert(s.invitations).values({
        id: invitation,
        projectId: project,
        buildingId: building,
        kind: "resident",
        tokenHash: crypto.randomUUID().replaceAll("-", "").repeat(2),
        createdBy: admin,
        expiresAt: new Date(Date.now() + 86400000),
      });
      await tx.insert(s.joinRequests).values({
        invitationId: invitation,
        userId: pending,
        apartmentId: apartment,
        fullName: "Pending",
        householdName: "Pending home",
      });
    });
  });
  afterAll(async () => {
    if (!fixture) return;
    await fixture.db.delete(s.projects).where(eq(s.projects.id, project));
    await fixture.db.delete(s.userPersonLinks).where(eq(s.userPersonLinks.userId, resident));
    await fixture.db.delete(s.parties).where(eq(s.parties.id, person));
    await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, users));
    await fixture.client.end();
  });
  it("persists submissions from residents, pending/unlinked accounts and managers", async () => {
    for (const user of [admin, resident, pending, unlinked, pm, bm]) {
      const body = input();
      const response = await POST(await request("POST", user, body));
      expect(response.status).toBe(200);
      const { id } = await response.json();
      const [saved] = await fixture.db
        .select()
        .from(s.productFeedback)
        .where(eq(s.productFeedback.id, id));
      expect(saved).toMatchObject({ authorUserId: user, ...body });
      expect(saved.createdAt).toBeInstanceOf(Date);
    }
  });
  it("requires a real signed session and rejects forged authors", async () => {
    expect((await POST(await request("POST", undefined, input()))).status).toBe(401);
    expect((await GET(await request("GET"))).status).toBe(401);
    expect(
      (await POST(await request("POST", unlinked, { ...input(), authorUserId: admin }))).status,
    ).toBe(400);
  });
  it("deduplicates concurrent identical submissions and isolates authors", async () => {
    const body = input();
    const responses = await Promise.all(
      Array.from({ length: 5 }, async () => POST(await request("POST", unlinked, body))),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(
      (await POST(await request("POST", unlinked, { ...body, message: "different" }))).status,
    ).toBe(409);
    const other = await POST(await request("POST", pending, body));
    expect((await other.json()).id).not.toBe(results[0].id);
    const rows = await fixture.db
      .select()
      .from(s.productFeedback)
      .where(eq(s.productFeedback.submissionId, body.submissionId));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.message === body.message)).toBe(true);
  });
  it("allows only global admins to review, including after grant revocation", async () => {
    for (const user of [resident, pending, unlinked, pm, bm])
      expect((await GET(await request("GET", user))).status).toBe(403);
    const headers = (await request("GET", admin)).headers;
    expect(
      (await GET(new Request(`${config.baseURL}/api/product-feedback`, { headers }))).status,
    ).toBe(200);
    await fixture.db.delete(s.globalRoles).where(eq(s.globalRoles.userId, admin));
    expect(
      (await GET(new Request(`${config.baseURL}/api/product-feedback`, { headers }))).status,
    ).toBe(403);
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
  });
  it("paginates deterministically with timestamp ties and returns only review fields", async () => {
    const rows = Array.from({ length: 21 }, () => ({
      ...input(),
      authorUserId: unlinked,
      createdAt: new Date("2100-01-01"),
    }));
    const inserted = await fixture.db
      .insert(s.productFeedback)
      .values(rows)
      .returning({ id: s.productFeedback.id });
    const ids = inserted
      .map((row) => row.id)
      .sort()
      .reverse();
    const first = await (await GET(await request("GET", admin))).json();
    const second = await (await GET(await request("GET", admin, undefined, "?page=2"))).json();
    expect(first.feedback.map((row: { id: string }) => row.id)).toEqual(ids.slice(0, 20));
    expect(first.hasNext).toBe(true);
    expect(second.feedback[0].id).toBe(ids[20]);
    expect(Object.keys(first.feedback[0]).sort()).toEqual([
      "authorUserId",
      "createdAt",
      "id",
      "message",
    ]);
    expect((await GET(await request("GET", admin, undefined, "?page=10001"))).status).toBe(400);
  });
  it("enforces database constraints, atomic rollback and account deletion", async () => {
    const body = { ...input(), authorUserId: removable };
    await fixture.db.insert(s.productFeedback).values(body);
    await expect(fixture.db.insert(s.productFeedback).values(body)).rejects.toThrow();
    for (const message of ["", " \n\t ", "x".repeat(2001)])
      await expect(
        fixture.db
          .insert(s.productFeedback)
          .values({ ...body, submissionId: crypto.randomUUID(), message }),
      ).rejects.toThrow();
    await expect(submitFeedback(fixture.db, crypto.randomUUID(), input())).rejects.toThrow();
    const rollback = input();
    await expect(
      fixture.db.transaction(async (tx) => {
        await tx.insert(s.productFeedback).values({ ...rollback, authorUserId: removable });
        throw new Error("rollback fixture");
      }),
    ).rejects.toThrow("rollback fixture");
    expect(
      await fixture.db
        .select()
        .from(s.productFeedback)
        .where(eq(s.productFeedback.submissionId, rollback.submissionId)),
    ).toHaveLength(0);
    await fixture.db.delete(s.appUsers).where(eq(s.appUsers.id, removable));
    expect(
      await fixture.db
        .select()
        .from(s.productFeedback)
        .where(eq(s.productFeedback.authorUserId, removable)),
    ).toHaveLength(0);
  });
});
