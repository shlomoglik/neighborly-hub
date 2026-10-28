import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { createProjectStructure } from "../db/project-structure";
import { readManagementHierarchy } from "./management";
import { readDirectoryProjects } from "./projects";
import {
  renewInvitation,
  createInvitation,
  hashInvitationToken,
  listInvitations,
  listJoinRequests,
} from "./invitations";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import {
  POST as create,
  GET as discover,
} from "@/app/api/management/projects/[projectId]/invitations/route";
import { POST as inspectRecipient } from "@/app/api/management/projects/[projectId]/staff/recipient/route";
import {
  POST as renew,
  DELETE as revoke,
} from "@/app/api/management/projects/[projectId]/invitations/[invitationId]/route";
import { POST as submit, GET as context } from "@/app/api/join/[token]/route";
import { POST as review } from "@/app/api/management/projects/[projectId]/join-requests/[requestId]/route";
import { assignProjectStaff, inspectStaffRecipient } from "./staff";
import { GET as mine } from "@/app/api/join/requests/route";
const config = {
  baseURL: "https://invite.test",
  secret: "invitation-integration-only-32-character-secret",
  googleClientId: "test",
  googleClientSecret: "test",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 4 });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("PostgreSQL invitation onboarding and global identity separation", () => {
  const users = Array.from({ length: 11 }, () => crypto.randomUUID());
  const [
    admin,
    admin2,
    pm,
    bm,
    applicant,
    linked,
    stranger,
    collision,
    claimant,
    staffTarget,
    unverified,
  ] = users;
  const projects: string[] = [];
  let a: string;
  let b: string;
  let c: string;
  let buildingA: string;
  let buildingOther: string;
  let apartmentA: string;
  let apartmentB: string;
  let apartmentC: string;
  let apartmentSpare: string;
  let linkedPerson: string;
  const ctx = (projectId = a) => ({ params: Promise.resolve({ projectId }) });
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({
          id,
          email: `${id}@example.test`,
          name: "Account fixture",
          emailVerified: id !== unverified,
        }),
      );
    await fixture.db.insert(s.globalRoles).values([
      { userId: admin, role: "admin" },
      { userId: admin2, role: "admin" },
    ]);
    for (let n = 0; n < 3; n++) {
      const created = await createProjectStructure(
        {
          name: `Invitation fixture ${n}`,
          buildings: [
            {
              name: "A",
              floors: [
                {
                  number: 0,
                  apartments: Array.from({ length: 12 }, (_, i) => ({ number: String(i + 1) })),
                },
              ],
            },
            { name: "Other", floors: [{ number: 0, apartments: [{ number: "1" }] }] },
          ],
        },
        fixture.db,
      );
      projects.push(created.projectId);
    }
    [a, b, c] = projects;
    const data = (await readManagementHierarchy(fixture.db, admin, a))!;
    buildingA = data.buildings[0].id;
    buildingOther = data.buildings[1].id;
    apartmentA = data.buildings[0].floors[0].apartments[0].id;
    apartmentSpare = data.buildings[0].floors[0].apartments[1].id;
    apartmentB = (await readManagementHierarchy(fixture.db, admin, b))!.buildings[0].floors[0]
      .apartments[0].id;
    apartmentC = (await readManagementHierarchy(fixture.db, admin, c))!.buildings[0].floors[0]
      .apartments[0].id;
    await fixture.db.insert(s.staffAssignments).values([
      { userId: pm, projectId: a, role: "project_manager" },
      { userId: bm, projectId: a, buildingId: buildingA, role: "building_manager" },
      { userId: linked, projectId: c, role: "project_manager" },
    ]);
    await fixture.db.transaction(async (tx) => {
      const [party] = await tx
        .insert(s.parties)
        .values({ kind: "person" })
        .returning({ id: s.parties.id });
      linkedPerson = party.id;
      await tx
        .insert(s.people)
        .values({ partyId: linkedPerson, fullName: "Existing verified person" });
      await tx
        .insert(s.userPersonLinks)
        .values({ userId: linked, personId: linkedPerson, verifiedBy: admin });
    });
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      const links = await fixture.db
        .select({ id: s.userPersonLinks.personId })
        .from(s.userPersonLinks)
        .where(inArray(s.userPersonLinks.userId, users));
      await fixture.db.delete(s.projects).where(inArray(s.projects.id, projects));
      await fixture.db.delete(s.userPersonLinks).where(inArray(s.userPersonLinks.userId, users));
      if (links.length)
        await fixture.db.delete(s.parties).where(
          inArray(
            s.parties.id,
            links.map((l) => l.id),
          ),
        );
      await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, users));
    } finally {
      await fixture.client.end();
    }
  });
  async function request(method: string, user?: string, body?: unknown, origin = config.baseURL) {
    const headers = new Headers(
      user ? (await (await fixture.auth.$context).test.login({ userId: user })).headers : undefined,
    );
    headers.set("origin", origin);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    headers.set("x-role", "admin");
    return new Request(config.baseURL + "/api?userId=" + admin, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  function check(r: Response, code: number) {
    expect(r.status).toBe(code);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Vary")).toBe("Cookie");
  }
  async function invite(
    actor = admin,
    projectId = a,
    apartmentId: string | null = apartmentA,
    buildingId = buildingA,
  ) {
    const r = await create(
      await request("POST", actor, { kind: "resident", buildingId, apartmentId, expiresInDays: 7 }),
      ctx(projectId),
    );
    check(r, 201);
    const result = await r.json();
    return { ...result, token: new URL(result.url).pathname.split("/").at(-1) as string };
  }
  async function apply(token: string, user: string, apartmentId = apartmentA) {
    return submit(
      await request("POST", user, {
        apartmentId,
        fullName: "Requested representative",
        householdName: "Requested household",
      }),
      { params: Promise.resolve({ token }) },
    );
  }
  async function decide(
    id: string,
    actor = admin,
    projectId = a,
    decision: "approve" | "reject" = "approve",
  ) {
    return review(await request("POST", actor, { decision }), {
      params: Promise.resolve({ projectId, requestId: id }),
    });
  }
  it("requires a verified session and scopes invitations independently of resident directory access", async () => {
    check(
      await create(
        await request("POST", undefined, {
          kind: "project_manager",
          recipientEmail: `${staffTarget}@example.test`,
          expiresInDays: 7,
        }),
        ctx(),
      ),
      401,
    );
    for (const actor of [applicant, stranger])
      check(
        await create(
          await request("POST", actor, {
            kind: "resident",
            buildingId: buildingA,
            apartmentId: null,
          }),
          ctx(),
        ),
        404,
      );
    for (const actor of [pm, bm])
      check(
        await create(
          await request("POST", actor, {
            kind: "building_manager",
            buildingId: buildingA,
            recipientEmail: `${staffTarget}@example.test`,
          }),
          ctx(),
        ),
        404,
      );
    check(
      await create(
        await request("POST", bm, {
          kind: "resident",
          buildingId: buildingOther,
          apartmentId: null,
        }),
        ctx(),
      ),
      404,
    );
    check(
      await create(
        await request("POST", pm, {
          kind: "resident",
          buildingId: buildingA,
          apartmentId: apartmentB,
        }),
        ctx(),
      ),
      404,
    );
    check(await discover(await request("GET", bm), ctx()), 200);
    expect((await listInvitations(fixture.db, bm, a)).canInviteStaff).toBe(false);
    check(
      await context(await request("GET"), { params: Promise.resolve({ token: "a".repeat(64) }) }),
      401,
    );
  });
  it("does not consume links on repeated GET/prefetch and stores only a hash", async () => {
    const i = await invite();
    for (let n = 0; n < 3; n++)
      check(
        await context(await request("GET", applicant), {
          params: Promise.resolve({ token: i.token }),
        }),
        200,
      );
    const [row] = await fixture.db.select().from(s.invitations).where(eq(s.invitations.id, i.id));
    expect(row.tokenHash).toBe(hashInvitationToken(i.token));
    expect(row.consumedAt).toBeNull();
    expect(JSON.stringify(row)).not.toContain(i.token);
    const list = await discover(await request("GET", admin), ctx());
    expect(JSON.stringify(await list.json())).not.toContain(row.tokenHash);
  });
  it("keeps pending requests separate, idempotently claims personal links and atomically provisions approval", async () => {
    const i = await invite(pm);
    const pending = await apply(i.token, applicant);
    check(pending, 201);
    const { id } = await pending.json();
    expect(await readDirectoryProjects(fixture.db, applicant)).toEqual([]);
    expect(
      await fixture.db.select().from(s.households).where(eq(s.households.apartmentId, apartmentA)),
    ).toEqual([]);
    expect(
      await fixture.db
        .select()
        .from(s.userPersonLinks)
        .where(eq(s.userPersonLinks.userId, applicant)),
    ).toEqual([]);
    expect(await (await apply(i.token, applicant)).json()).toMatchObject({ id, status: "pending" });
    check(await apply(i.token, stranger), 404);
    check(await decide(id, bm), 200);
    const [link] = await fixture.db
      .select()
      .from(s.userPersonLinks)
      .where(eq(s.userPersonLinks.userId, applicant));
    expect(link.verifiedBy).toBe(bm);
    expect(
      await fixture.db.select().from(s.households).where(eq(s.households.apartmentId, apartmentA)),
    ).toMatchObject([{ approvalStatus: "approved", isActive: true }]);
    expect((await readDirectoryProjects(fixture.db, applicant)).map((p) => p.id)).toEqual([a]);
    check(await decide(id), 409);
  });
  it("reuses existing people/accounts across projects and retains unrelated staff assignments", async () => {
    const beforeUsers = await fixture.db
      .select({ id: s.appUsers.id })
      .from(s.appUsers)
      .where(eq(s.appUsers.id, linked));
    const target = (await readManagementHierarchy(fixture.db, admin, b))!.buildings[0];
    const i = await invite(admin, b, apartmentB, target.id);
    const r = await apply(i.token, linked, apartmentB);
    check(r, 201);
    check(await decide((await r.json()).id, admin, b), 200);
    expect(
      await fixture.db.select().from(s.userPersonLinks).where(eq(s.userPersonLinks.userId, linked)),
    ).toMatchObject([{ personId: linkedPerson }]);
    expect(
      await fixture.db.select().from(s.people).where(eq(s.people.partyId, linkedPerson)),
    ).toMatchObject([{ fullName: "Existing verified person" }]);
    expect(
      await fixture.db
        .select({ id: s.appUsers.id })
        .from(s.appUsers)
        .where(eq(s.appUsers.id, linked)),
    ).toEqual(beforeUsers);
    expect((await readManagementHierarchy(fixture.db, linked, c))!.id).toBe(c);
    expect((await readDirectoryProjects(fixture.db, linked)).map((p) => p.id)).toContain(b);
    // A person already provisioned by this flow can join another project as well.
    const previous = (
      await fixture.db
        .select()
        .from(s.userPersonLinks)
        .where(eq(s.userPersonLinks.userId, applicant))
    )[0];
    const third = (await readManagementHierarchy(fixture.db, admin, c))!.buildings[0];
    const next = await invite(admin, c, apartmentC, third.id);
    const r2 = await apply(next.token, applicant, apartmentC);
    check(await decide((await r2.json()).id, admin, c), 200);
    expect(
      (
        await fixture.db
          .select()
          .from(s.userPersonLinks)
          .where(eq(s.userPersonLinks.userId, applicant))
      )[0],
    ).toEqual(previous);
    expect((await readDirectoryProjects(fixture.db, applicant)).map((p) => p.id).sort()).toEqual(
      [a, c].sort(),
    );
  });
  it("supports reusable building links without reserving apartments and rejects forged selections", async () => {
    const i = await invite(bm, a, null);
    const otherUnit = (await readManagementHierarchy(fixture.db, admin, a))!.buildings[1].floors[0]
      .apartments[0].id;
    check(await apply(i.token, stranger, otherUnit), 404);
    const r1 = await apply(i.token, stranger, apartmentSpare);
    const r2 = await apply(i.token, collision, apartmentSpare);
    check(r1, 201);
    check(r2, 201);
    const id1 = (await r1.json()).id;
    const id2 = (await r2.json()).id;
    const [row] = await fixture.db.select().from(s.invitations).where(eq(s.invitations.id, i.id));
    expect(row.consumedAt).toBeNull();
    expect(
      await fixture.db
        .select()
        .from(s.households)
        .where(eq(s.households.apartmentId, apartmentSpare)),
    ).toEqual([]);
    const results = await Promise.all([decide(id1, admin), decide(id2, admin2)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await fixture.db
        .select()
        .from(s.households)
        .where(eq(s.households.apartmentId, apartmentSpare)),
    ).toHaveLength(1);
    expect(
      await fixture.db
        .select()
        .from(s.userPersonLinks)
        .where(inArray(s.userPersonLinks.userId, [stranger, collision])),
    ).toHaveLength(1);
    const pending = await fixture.db
      .select()
      .from(s.joinRequests)
      .where(and(eq(s.joinRequests.invitationId, i.id), eq(s.joinRequests.status, "pending")));
    expect(pending).toHaveLength(1);
    check(await decide(pending[0].id, admin, a, "reject"), 200);
  });
  it("adds scoped staff roles only on independent admin approval without creating resident records", async () => {
    const created = await create(
      await request("POST", admin, {
        kind: "building_manager",
        recipientEmail: `${staffTarget}@example.test`,
        buildingId: buildingOther,
        expiresInDays: 7,
      }),
      ctx(),
    );
    check(created, 201);
    const link = await created.json();
    const token = new URL(link.url).pathname.split("/").at(-1)!;
    const r = await submit(await request("POST", staffTarget, {}), {
      params: Promise.resolve({ token }),
    });
    check(r, 201);
    const { id } = await r.json();
    expect(await readManagementHierarchy(fixture.db, staffTarget, a)).toBeNull();
    check(await decide(id, pm), 404);
    check(await decide(id, bm), 404);
    check(await decide(id, admin), 200);
    expect(
      (await readManagementHierarchy(fixture.db, staffTarget, a))!.buildings.map((b) => b.id),
    ).toEqual([buildingOther]);
    expect(
      await fixture.db
        .select()
        .from(s.userPersonLinks)
        .where(eq(s.userPersonLinks.userId, staffTarget)),
    ).toEqual([]);
    const personal = await create(
      await request("POST", admin, {
        kind: "project_manager",
        recipientEmail: `${staffTarget}@example.test`,
        expiresInDays: 7,
      }),
      ctx(c),
    );
    const token2 = new URL((await personal.json()).url).pathname.split("/").at(-1)!;
    const p = await submit(await request("POST", staffTarget, {}), {
      params: Promise.resolve({ token: token2 }),
    });
    check(await decide((await p.json()).id, admin, c), 200);
    expect(
      (await readManagementHierarchy(fixture.db, staffTarget, a))!.buildings.map((b) => b.id),
    ).toEqual([buildingOther]);
    expect((await readManagementHierarchy(fixture.db, staffTarget, c))!.buildings.length).toBe(2);
    expect(
      (await listJoinRequests(fixture.db, pm, a)).requests.some((r) => r.kind !== "resident"),
    ).toBe(false);
  });
  it("binds existing verified accounts by ID and requires verified email for future accounts", async () => {
    const r = await create(
      await request("POST", admin, {
        kind: "resident",
        buildingId: buildingA,
        apartmentId: null,
        recipientEmail: `${claimant}@example.test`,
      }),
      ctx(),
    );
    const result = await r.json();
    const token = new URL(result.url).pathname.split("/").at(-1)!;
    const [stored] = await fixture.db
      .select()
      .from(s.invitations)
      .where(eq(s.invitations.id, result.id));
    expect(stored.recipientUserId).toBe(claimant);
    check(
      await context(await request("GET", applicant), { params: Promise.resolve({ token }) }),
      404,
    );
    await fixture.db
      .update(s.appUsers)
      .set({ email: `changed-${claimant}@example.test` })
      .where(eq(s.appUsers.id, claimant));
    check(
      await context(await request("GET", claimant), { params: Promise.resolve({ token }) }),
      200,
    );
    const unverifiedInvite = await create(
      await request("POST", admin, {
        kind: "resident",
        buildingId: buildingA,
        apartmentId: null,
        recipientEmail: `${unverified}@example.test`,
      }),
      ctx(),
    );
    const token2 = new URL((await unverifiedInvite.json()).url).pathname.split("/").at(-1)!;
    check(
      await context(await request("GET", unverified), {
        params: Promise.resolve({ token: token2 }),
      }),
      404,
    );
    await fixture.db
      .update(s.appUsers)
      .set({ emailVerified: true })
      .where(eq(s.appUsers.id, unverified));
    check(
      await context(await request("GET", unverified), {
        params: Promise.resolve({ token: token2 }),
      }),
      200,
    );
  });
  it("blocks self review, cross-scope review/revocation and expired/revoked invitations without removing approved access", async () => {
    const i = await invite(admin, a, null);
    const self = await apply(i.token, admin, apartmentSpare);
    check(await decide((await self.json()).id, admin), 403);
    check(
      await revoke(await request("DELETE", bm), {
        params: Promise.resolve({ projectId: b, invitationId: i.id }),
      }),
      404,
    );
    const revoked = await invite(admin, a, null);
    const r = await apply(revoked.token, claimant, apartmentSpare);
    const id = (await r.json()).id;
    check(
      await revoke(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: a, invitationId: revoked.id }),
      }),
      200,
    );
    check(await decide(id), 409);
    check(await decide(id, admin, a, "reject"), 200);
    check(await apply(revoked.token, unverified), 404);
    const expired = await invite(admin, a, null);
    const pending = await apply(expired.token, unverified, apartmentSpare);
    await fixture.db
      .update(s.invitations)
      .set({ createdAt: new Date(0), expiresAt: new Date(1000) })
      .where(eq(s.invitations.id, expired.id));
    check(await decide((await pending.json()).id), 409);
    check(await apply(expired.token, staffTarget), 404);
    expect((await readDirectoryProjects(fixture.db, applicant)).map((p) => p.id)).toContain(a);
    const own = await mine(await request("GET", applicant));
    check(own, 200);
    expect(
      (await own.json()).requests.every(
        (row: { accountEmail: string }) => row.accountEmail === `${applicant}@example.test`,
      ),
    ).toBe(true);
  });
  it("combines independent management grants and never turns resident directory visibility into management", async () => {
    check(await discover(await request("GET", applicant), ctx()), 404);
    const other = await invite(admin, a, null, buildingOther);
    const otherUnit = (await readManagementHierarchy(fixture.db, admin, a))!.buildings[1].floors[0]
      .apartments[0].id;
    const pending = await apply(other.token, staffTarget, otherUnit);
    const id = (await pending.json()).id;
    expect((await listJoinRequests(fixture.db, bm, a)).requests.some((r) => r.id === id)).toBe(
      false,
    );
    check(await decide(id, bm), 404);
    const targetB = (await readManagementHierarchy(fixture.db, admin, b))!.buildings[0];
    const [additional] = await fixture.db
      .insert(s.staffAssignments)
      .values({ userId: bm, projectId: a, buildingId: buildingOther, role: "building_manager" })
      .returning({ id: s.staffAssignments.id });
    await fixture.db
      .insert(s.staffAssignments)
      .values({ userId: bm, projectId: b, buildingId: targetB.id, role: "building_manager" });
    expect((await listJoinRequests(fixture.db, bm, a)).requests.some((r) => r.id === id)).toBe(
      true,
    );
    check(await discover(await request("GET", bm), ctx(b)), 200);
    check(await discover(await request("GET", bm), ctx(c)), 404);
    const reusable = await invite(bm, b, null, targetB.id);
    const result = await context(await request("GET", unverified), {
      params: Promise.resolve({ token: reusable.token }),
    });
    expect((await result.json()).apartments.map((a: { number: string }) => a.number)).toEqual(
      Array.from({ length: 12 }, (_, n) => String(n + 1)),
    );
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.id, additional.id));
    expect((await listJoinRequests(fixture.db, bm, a)).requests.some((r) => r.id === id)).toBe(
      false,
    );
    check(await decide(id, bm), 404);
    check(await apply(reusable.token, unverified, targetB.floors[0].apartments[0].id), 201);
    // Removing only the B grant invalidates its link while the independent A grant still works.
    await fixture.db
      .delete(s.staffAssignments)
      .where(and(eq(s.staffAssignments.userId, bm), eq(s.staffAssignments.projectId, b)));
    check(await discover(await request("GET", bm), ctx(b)), 404);
    check(await discover(await request("GET", bm), ctx(a)), 200);
    check(await apply(reusable.token, claimant, targetB.floors[0].apartments[0].id), 404);
  });
  it("rejects forged identity/role payloads, enforces origin checks, and rechecks issuer/reviewer grants and sessions", async () => {
    const i = await invite(pm, a, null);
    check(
      await submit(
        await request("POST", applicant, {
          apartmentId: apartmentSpare,
          fullName: "A",
          householdName: "B",
          userId: admin,
          role: "admin",
        }),
        { params: Promise.resolve({ token: i.token }) },
      ),
      400,
    );
    for (const origin of ["", "https://evil.test"]) {
      check(
        await create(await request("POST", admin, { kind: "project_manager" }, origin), ctx()),
        403,
      );
      check(
        await submit(await request("POST", applicant, {}, origin), {
          params: Promise.resolve({ token: i.token }),
        }),
        403,
      );
    }
    const pending = await apply(i.token, staffTarget);
    const pendingId = (await pending.json()).id;
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.userId, pm));
    expect(
      (await listJoinRequests(fixture.db, admin, a)).requests.find((r) => r.id === pendingId)
        ?.invitationActive,
    ).toBe(false);
    check(await decide(pendingId), 409);
    expect(await (await apply(i.token, staffTarget)).json()).toMatchObject({
      id: pendingId,
      status: "pending",
    });
    check(await apply(i.token, claimant), 404);
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.userId, bm));
    check(await discover(await request("GET", bm), ctx()), 404);
    const signed = await (await fixture.auth.$context).test.login({ userId: admin });
    await fixture.db
      .update(s.authSessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.authSessions.token, signed.token));
    check(await discover(new Request(config.baseURL, { headers: signed.headers }), ctx()), 401);
  });
  it("inspects accounts, blocks redundant roles and upgrades building grants atomically", async () => {
    const target = {
      email: `${staffTarget}@example.test`,
      role: "project_manager" as const,
      buildingId: null,
    };
    expect(await inspectStaffRecipient(fixture.db, admin, a, target)).toEqual({
      account: "existing",
      role: "upgrade",
    });
    await expect(inspectStaffRecipient(fixture.db, staffTarget, a, target)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await inspectStaffRecipient(fixture.db, admin, a, {
        ...target,
        email: "not-registered@example.test",
      }),
    ).toEqual({ account: "new", role: "available" });
    const invitation = await createInvitation(fixture.db, admin, a, {
      kind: "project_manager",
      recipientEmail: target.email,
      expiresInDays: 7,
    });
    const pending = await submit(await request("POST", staffTarget, {}), {
      params: Promise.resolve({ token: invitation.token }),
    });
    check(await decide((await pending.json()).id), 200);
    const grants = await fixture.db
      .select()
      .from(s.staffAssignments)
      .where(and(eq(s.staffAssignments.userId, staffTarget), eq(s.staffAssignments.projectId, a)));
    expect(grants.map((g) => g.role)).toEqual(["project_manager"]);
    expect(await inspectStaffRecipient(fixture.db, admin, a, target)).toEqual({
      account: "existing",
      role: "assigned",
    });
    await expect(
      createInvitation(fixture.db, admin, a, {
        kind: "building_manager",
        recipientEmail: target.email,
        buildingId: buildingA,
        expiresInDays: 7,
      }),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_ASSIGNED" });
    await expect(assignProjectStaff(fixture.db, admin, a, target)).rejects.toMatchObject({
      status: 409,
      code: "ALREADY_ASSIGNED",
    });
  });
  it("renews expired or pending invitations without exposing or retaining the old bearer token", async () => {
    const i = await createInvitation(fixture.db, admin, b, {
      kind: "resident",
      buildingId: (await readManagementHierarchy(fixture.db, admin, b))!.buildings[0].id,
      apartmentId: null,
      expiresInDays: 7,
    });
    await expect(renewInvitation(fixture.db, stranger, b, i.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(renewInvitation(fixture.db, admin, a, i.id)).rejects.toMatchObject({
      status: 404,
    });
    await fixture.db
      .update(s.invitations)
      .set({ expiresAt: new Date(0), revokedAt: new Date() })
      .where(eq(s.invitations.id, i.id));
    const renewed = await renewInvitation(fixture.db, admin, b, i.id);
    expect(renewed.id).toBe(i.id);
    expect(renewed.token).not.toBe(i.token);
    check(
      await context(await request("GET", applicant), {
        params: Promise.resolve({ token: i.token }),
      }),
      404,
    );
    check(
      await context(await request("GET", applicant), {
        params: Promise.resolve({ token: renewed.token }),
      }),
      200,
    );
    const listing = await listInvitations(fixture.db, admin, b);
    expect(JSON.stringify(listing)).not.toContain(renewed.token);
    const [row] = await fixture.db.select().from(s.invitations).where(eq(s.invitations.id, i.id));
    expect(row.tokenHash).toBe(hashInvitationToken(renewed.token));
    expect(row.revokedAt).toBeNull();
  });
  it("separates new-account creation from role approval and preserves pending requests when re-sharing", async () => {
    const id = crypto.randomUUID();
    const email = `${id}@example.test`;
    const target = { email, role: "project_manager" as const, buildingId: null };
    const inspected = await inspectRecipient(await request("POST", admin, target), ctx(b));
    check(inspected, 200);
    expect(await inspected.json()).toEqual({ account: "new", role: "available" });
    check(await inspectRecipient(await request("POST", staffTarget, target), ctx(b)), 403);
    const link = await createInvitation(fixture.db, admin, b, {
      kind: "project_manager",
      recipientEmail: email,
      expiresInDays: 7,
    });
    check(
      await submit(await request("POST", stranger, {}), {
        params: Promise.resolve({ token: link.token }),
      }),
      404,
    );
    const test = (await fixture.auth.$context).test;
    await test.saveUser(test.createUser({ id, email, name: "New account", emailVerified: false }));
    users.push(id);
    check(
      await submit(await request("POST", id, {}), {
        params: Promise.resolve({ token: link.token }),
      }),
      404,
    );
    await fixture.db.update(s.appUsers).set({ emailVerified: true }).where(eq(s.appUsers.id, id));
    const pending = await submit(await request("POST", id, {}), {
      params: Promise.resolve({ token: link.token }),
    });
    check(pending, 201);
    const pendingId = (await pending.json()).id;
    expect(await readManagementHierarchy(fixture.db, id, b)).toBeNull();
    const renewed = await renew(await request("POST", admin), {
      params: Promise.resolve({ projectId: b, invitationId: link.id }),
    });
    check(renewed, 200);
    const token = new URL((await renewed.json()).url).pathname.split("/").at(-1)!;
    check(
      await context(await request("GET", id), { params: Promise.resolve({ token: link.token }) }),
      404,
    );
    const current = await context(await request("GET", id), { params: Promise.resolve({ token }) });
    expect((await current.json()).request).toEqual({ id: pendingId, status: "pending" });
    check(await decide(pendingId, admin, b), 200);
    expect(await readManagementHierarchy(fixture.db, id, b)).not.toBeNull();
    await expect(
      createInvitation(fixture.db, admin, b, {
        kind: "project_manager",
        recipientEmail: email,
        expiresInDays: 7,
      }),
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_ASSIGNED" });
    check(
      await renew(await request("POST", admin), {
        params: Promise.resolve({ projectId: b, invitationId: link.id }),
      }),
      409,
    );
  });
  it("bounds scoped invitation/request pagination without returning token hashes or raw account IDs", async () => {
    for (let n = 0; n < 22; n++)
      await createInvitation(fixture.db, admin, a, {
        kind: "resident",
        buildingId: buildingA,
        apartmentId: null,
        expiresInDays: 7,
      });
    const first = await listInvitations(fixture.db, admin, a);
    const second = await listInvitations(fixture.db, admin, a, 2);
    expect(first.invitations).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(new Set([...first.invitations, ...second.invitations].map((i) => i.id)).size).toBe(
      first.invitations.length + second.invitations.length,
    );
    const body = JSON.stringify(await listJoinRequests(fixture.db, admin, a));
    expect(body).not.toContain('"userId"');
    expect(body).not.toContain('"tokenHash"');
  });
});
