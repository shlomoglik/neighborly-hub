import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { createProjectStructure } from "../db/project-structure";
import { readManagementHierarchy, readManagementProjects } from "./management";
import { readDirectoryProjects } from "./projects";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET as discover } from "@/app/api/management/projects/route";
import { GET as detail } from "@/app/api/management/projects/[projectId]/route";
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 1 });
  const db = drizzle(client, { schema: s });
  const auth = betterAuth({
    ...createAuth(db, {
      baseURL: "https://management.test",
      secret: "management-integration-only-32-character-secret",
      googleClientId: "test",
      googleClientSecret: "test",
    }).options,
    plugins: [testUtils()],
  });
  return { client, db, auth };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("PostgreSQL management authorization and authenticated routes", () => {
  const users = Array.from({ length: 6 }, () => crypto.randomUUID());
  const [admin, manager, buildingManager, resident, outsider, mixed] = users;
  const party = crypto.randomUUID();
  let projectId: string;
  let otherId: string;
  let a: string;
  let b: string;
  let c: string;
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({
          id,
          email: `${id}@example.test`,
          name: "Management fixture",
          emailVerified: true,
        }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    ({ projectId } = await createProjectStructure(
      {
        name: "Management integration",
        city: "Sderot",
        buildings: [
          {
            name: "A",
            floors: [
              {
                number: 0,
                apartments: [
                  { number: "10" },
                  { number: "2" },
                  { number: "Studio" },
                  { number: "02" },
                ],
              },
              { number: -1, apartments: [] },
            ],
          },
          { name: "B", floors: [] },
          { name: "C", floors: [{ number: 1, apartments: [{ number: "1" }] }] },
        ],
      },
      fixture.db,
    ));
    ({ projectId: otherId } = await createProjectStructure(
      { name: "Other management project", city: "Haifa", buildings: [{ name: "D", floors: [] }] },
      fixture.db,
    ));
    const all = (await readManagementHierarchy(fixture.db, admin, projectId))!.buildings;
    [a, b, c] = all.map((b) => b.id);
    await fixture.db.insert(s.staffAssignments).values([
      { userId: manager, projectId, role: "project_manager" },
      { userId: buildingManager, projectId, buildingId: a, role: "building_manager" },
      { userId: buildingManager, projectId, buildingId: b, role: "building_manager" },
      { userId: mixed, projectId, buildingId: a, role: "building_manager" },
      { userId: mixed, projectId: otherId, role: "project_manager" },
    ]);
    // A community-visible resident directory is intentionally broader than management.
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values({ id: party, kind: "person" });
      await tx.insert(s.people).values({ partyId: party, fullName: "Private fixture person" });
    });
    await fixture.db
      .insert(s.userPersonLinks)
      .values({ userId: resident, personId: party, verifiedBy: admin });
    const [home] = await fixture.db
      .insert(s.households)
      .values({
        apartmentId: all[0].floors[1].apartments[0].id,
        displayName: "Private household",
        approvalStatus: "approved",
      })
      .returning();
    await fixture.db.insert(s.householdMembers).values({ householdId: home.id, personId: party });
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(s.projects).where(inArray(s.projects.id, [projectId, otherId]));
      await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, users));
      await fixture.db.delete(s.parties).where(eq(s.parties.id, party));
    } finally {
      await fixture.client.end();
    }
  });
  const read = (user: string, id = projectId) => readManagementHierarchy(fixture.db, user, id);
  async function request(userId?: string) {
    const headers = new Headers(
      userId ? (await (await fixture.auth.$context).test.login({ userId })).headers : undefined,
    );
    headers.set("x-user-id", admin);
    return new Request("https://management.test/api/management/projects?userId=" + admin, {
      headers,
    });
  }
  it("combines staff grants, isolates projects, and scopes every count in SQL", async () => {
    expect((await read(admin))!.counts).toEqual({ buildings: 3, floors: 3, apartments: 5 });
    expect((await read(manager))!.counts).toEqual({ buildings: 3, floors: 3, apartments: 5 });
    const scoped = (await read(buildingManager))!;
    expect(scoped.buildings.map((b) => b.id)).toEqual([a, b]);
    expect(scoped.counts).toEqual({ buildings: 2, floors: 2, apartments: 4 });
    expect(JSON.stringify(scoped)).not.toContain(c);
    expect(await read(manager, otherId)).toBeNull();
    expect(await read(buildingManager, otherId)).toBeNull();
    expect((await read(mixed))!.buildings.map((b) => b.id)).toEqual([a]);
    expect((await read(mixed, otherId))!.buildings).toHaveLength(1);
    for (const user of [resident, outsider]) {
      expect(await read(user)).toBeNull();
      expect(await readManagementProjects(fixture.db, user)).toMatchObject({
        projects: [],
        canCreateProject: false,
        hasManagementAccess: false,
      });
    }
    expect((await readDirectoryProjects(fixture.db, resident)).map((p) => p.id)).toContain(
      projectId,
    );
    expect((await readManagementProjects(fixture.db, admin)).canCreateProject).toBe(true);
    expect(
      (await readManagementProjects(fixture.db, mixed)).projects.map((p) => p.id).sort(),
    ).toEqual([projectId, otherId].sort());
  });
  it("preserves empty buildings/floors and gives repeatable natural apartment ordering without personal fields", async () => {
    const result = (await read(admin))!;
    expect(result.buildings[1].floors).toEqual([]);
    expect(result.buildings[0].floors.map((f) => f.number)).toEqual([-1, 0]);
    expect(result.buildings[0].floors[0].apartments).toEqual([]);
    expect(result.buildings[0].floors[1].apartments.map((a) => a.number)).toEqual(
      expect.arrayContaining(["02", "2", "10", "Studio"]),
    );
    expect(result.buildings[0].floors[1].apartments.slice(2).map((a) => a.number)).toEqual([
      "10",
      "Studio",
    ]);
    expect(await read(admin)).toEqual(result);
    expect(Object.keys(result).sort()).toEqual(["buildings", "city", "counts", "id", "name"]);
    for (const secret of ["Private", "household", "contact", "role", "session", "email"])
      expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("uses only verified cookie identity; anonymous, resident, missing and invalid boundaries are private", async () => {
    const context = (projectId: string) => ({ params: Promise.resolve({ projectId }) });
    expect((await discover(await request())).status).toBe(401);
    expect((await detail(await request(), context(projectId))).status).toBe(401);
    for (const id of [projectId, crypto.randomUUID(), "invalid", ""]) {
      const result = await detail(await request(resident), context(id));
      expect(result.status).toBe(404);
      expect(await result.json()).toEqual({ error: "NOT_FOUND" });
      expect(result.headers.get("Cache-Control")).toBe("private, no-store");
      expect(result.headers.get("Vary")).toBe("Cookie");
    }
    const ok = await detail(await request(manager), context(projectId));
    expect(ok.status).toBe(200);
    expect((await ok.json()).counts.buildings).toBe(3);
    expect((await discover(await request(resident))).status).toBe(200);
  });
  it("bounds discovery and maintains deterministic pagination", async () => {
    const ids = Array.from({ length: 23 }, () => crypto.randomUUID());
    await fixture.db
      .insert(s.projects)
      .values(
        ids.map((id, i) => ({ id, name: `ZZZ management page ${String(i).padStart(2, "0")}` })),
      );
    try {
      const first = await readManagementProjects(fixture.db, admin);
      const next = await readManagementProjects(fixture.db, admin, 2);
      expect(first.projects).toHaveLength(20);
      expect(first.hasNext).toBe(true);
      expect(next.projects).toHaveLength(5);
      expect(new Set([...first.projects, ...next.projects].map((p) => p.id)).size).toBe(25);
    } finally {
      await fixture.db.delete(s.projects).where(inArray(s.projects.id, ids));
    }
  });
  it("rechecks revoked building, project, global grants and expired/revoked database sessions", async () => {
    await fixture.db
      .delete(s.staffAssignments)
      .where(eq(s.staffAssignments.userId, buildingManager));
    expect(await read(buildingManager)).toBeNull();
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.userId, manager));
    expect(await read(manager)).toBeNull();
    await fixture.db.delete(s.globalRoles).where(eq(s.globalRoles.userId, admin));
    expect(await read(admin)).toBeNull();
    expect((await readManagementProjects(fixture.db, admin)).canCreateProject).toBe(false);
    const test = (await fixture.auth.$context).test;
    const expired = await test.login({ userId: mixed });
    await fixture.db
      .update(s.authSessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.authSessions.token, expired.token));
    expect(
      (await discover(new Request("https://management.test", { headers: expired.headers }))).status,
    ).toBe(401);
    const revoked = await test.login({ userId: mixed });
    await fixture.db.delete(s.authSessions).where(eq(s.authSessions.token, revoked.token));
    expect(
      (await discover(new Request("https://management.test", { headers: revoked.headers }))).status,
    ).toBe(401);
  });
});
