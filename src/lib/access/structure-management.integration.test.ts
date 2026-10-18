import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { createProjectStructure } from "../db/project-structure";
import { readManagementHierarchy } from "./management";
import { readDirectoryProjects } from "./projects";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { POST, PATCH } from "@/app/api/management/projects/[projectId]/structure/route";
const config = {
  baseURL: "https://structure.test",
  secret: "structure-integration-only-32-character-secret",
  googleClientId: "test",
  googleClientSecret: "test",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 3 });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("PostgreSQL authorized structural mutations", () => {
  const users = Array.from({ length: 5 }, () => crypto.randomUUID());
  const [admin, pm, bm, resident, mixed] = users;
  const party = crypto.randomUUID();
  let project: string;
  let other: string;
  let a: string;
  let b: string;
  let f: string;
  let unit: string;
  let otherFloor: string;
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({
          id,
          email: `${id}@example.test`,
          name: "Structure fixture",
          emailVerified: true,
        }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    ({ projectId: project } = await createProjectStructure(
      {
        name: "Editable structure",
        buildings: [
          { name: "A", floors: [{ number: 0, apartments: [{ number: "1" }, { number: "2" }] }] },
          { name: "B", floors: [] },
        ],
      },
      fixture.db,
    ));
    ({ projectId: other } = await createProjectStructure(
      {
        name: "Other editable structure",
        buildings: [{ name: "Other", floors: [{ number: 0, apartments: [] }] }],
      },
      fixture.db,
    ));
    const data = (await readManagementHierarchy(fixture.db, admin, project))!;
    a = data.buildings[0].id;
    b = data.buildings[1].id;
    f = data.buildings[0].floors[0].id;
    unit = data.buildings[0].floors[0].apartments[0].id;
    otherFloor = (await readManagementHierarchy(fixture.db, admin, other))!.buildings[0].floors[0]
      .id;
    await fixture.db.insert(s.staffAssignments).values([
      { userId: pm, projectId: project, role: "project_manager" },
      { userId: bm, projectId: project, buildingId: a, role: "building_manager" },
      { userId: mixed, projectId: project, buildingId: b, role: "building_manager" },
      { userId: mixed, projectId: other, role: "project_manager" },
    ]);
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values({ id: party, kind: "person" });
      await tx.insert(s.people).values({ partyId: party, fullName: "Private fixture person" });
    });
    const [household] = await fixture.db
      .insert(s.households)
      .values({ apartmentId: unit, displayName: "Private home", approvalStatus: "approved" })
      .returning();
    await fixture.db
      .insert(s.householdMembers)
      .values({ householdId: household.id, personId: party });
    await fixture.db
      .insert(s.apartmentOwnerships)
      .values({ apartmentId: unit, ownerPartyId: party });
    await fixture.db
      .insert(s.userPersonLinks)
      .values({ userId: resident, personId: party, verifiedBy: admin });
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(s.userPersonLinks).where(eq(s.userPersonLinks.userId, resident));
      await fixture.db.delete(s.projects).where(inArray(s.projects.id, [project, other]));
      await fixture.db.delete(s.parties).where(eq(s.parties.id, party));
      await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, users));
    } finally {
      await fixture.client.end();
    }
  });
  async function call(
    input: unknown,
    actor?: string,
    update = false,
    projectId = project,
    origin = config.baseURL,
  ) {
    const headers = new Headers(
      actor
        ? (await (await fixture.auth.$context).test.login({ userId: actor })).headers
        : undefined,
    );
    headers.set("origin", origin);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    headers.set("x-role", "admin");
    return (update ? PATCH : POST)(
      new Request(config.baseURL + "/api?userId=" + admin, {
        method: update ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(input),
      }),
      { params: Promise.resolve({ projectId }) },
    );
  }
  function check(r: Response, status: number) {
    expect(r.status).toBe(status);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Vary")).toBe("Cookie");
  }
  it("enforces verified identity, resident-directory separation, and the complete management scope", async () => {
    check(await call({ entity: "building", name: "Anonymous" }), 401);
    for (const payload of [
      { entity: "floor", buildingId: a, number: 9 },
      { entity: "apartment", floorId: f, number: "Forbidden" },
    ])
      check(await call(payload, resident), 404);
    check(await call({ entity: "building", name: "Forbidden" }, bm), 404);
    check(await call({ entity: "floor", buildingId: b, number: 9 }, bm), 404);
    check(await call({ entity: "apartment", floorId: otherFloor, number: "Forbidden" }, pm), 404);
    check(await call({ entity: "floor", id: f, number: 99, expected: 0 }, mixed, true), 404);
    check(
      await call({ entity: "building", id: b, name: "Forbidden", expected: "B" }, bm, true),
      404,
    );
    expect((await readDirectoryProjects(fixture.db, resident)).map((p) => p.id)).toContain(project);
    expect((await readManagementHierarchy(fixture.db, bm, project))!.canAddBuilding).toBe(false);
    expect((await readManagementHierarchy(fixture.db, pm, project))!.canAddBuilding).toBe(true);
    check(await call({ entity: "floor", buildingId: b, number: -1 }, mixed), 201);
    check(await call({ entity: "floor", buildingId: a, number: -1 }, bm), 201);
    check(
      await call(
        { entity: "apartment", floorId: otherFloor, number: "Mixed" },
        mixed,
        false,
        other,
      ),
      201,
    );
  });
  it("creates persisted empty buildings/floors/apartments and refreshes actual hierarchy counts", async () => {
    for (const actor of [admin, pm]) {
      const building = await call({ entity: "building", name: `New ${actor}` }, actor);
      check(building, 201);
      const buildingId = (await building.json()).id;
      const floor = await call({ entity: "floor", buildingId, number: 3 }, actor);
      check(floor, 201);
      const floorId = (await floor.json()).id;
      check(await call({ entity: "apartment", floorId, number: "10" }, actor), 201);
      check(await call({ entity: "apartment", floorId, number: "2" }, actor), 201);
      const saved = (await readManagementHierarchy(fixture.db, actor, project))!.buildings.find(
        (b) => b.id === buildingId,
      )!;
      expect(saved.floors[0].apartments.map((a) => a.number)).toEqual(["2", "10"]);
      expect(
        Object.keys(await (await call({ entity: "floor", buildingId, number: 4 }, actor)).json()),
      ).toEqual(["id"]);
    }
  });
  it("updates labels in place without changing household, ownership, identity or staff relationships", async () => {
    const homes = await fixture.db
      .select()
      .from(s.households)
      .where(eq(s.households.apartmentId, unit));
    const owners = await fixture.db
      .select()
      .from(s.apartmentOwnerships)
      .where(eq(s.apartmentOwnerships.apartmentId, unit));
    const grants = await fixture.db
      .select()
      .from(s.staffAssignments)
      .where(eq(s.staffAssignments.buildingId, a));
    check(
      await call({ entity: "building", id: a, name: "Renamed A", expected: "A" }, bm, true),
      200,
    );
    check(await call({ entity: "floor", id: f, number: 5, expected: 0 }, bm, true), 200);
    const result = await call(
      { entity: "apartment", id: unit, number: "Studio", expected: "1" },
      bm,
      true,
    );
    check(result, 200);
    expect(await result.json()).toEqual({ id: unit });
    expect(
      await fixture.db.select().from(s.households).where(eq(s.households.apartmentId, unit)),
    ).toEqual(homes);
    expect(
      await fixture.db
        .select()
        .from(s.apartmentOwnerships)
        .where(eq(s.apartmentOwnerships.apartmentId, unit)),
    ).toEqual(owners);
    expect(
      await fixture.db
        .select()
        .from(s.staffAssignments)
        .where(eq(s.staffAssignments.buildingId, a)),
    ).toEqual(grants);
    const [apartment] = await fixture.db
      .select()
      .from(s.apartments)
      .where(eq(s.apartments.id, unit));
    expect(apartment).toMatchObject({ id: unit, buildingId: a, floorId: f, number: "Studio" });
    expect(
      await fixture.db
        .select()
        .from(s.userPersonLinks)
        .where(eq(s.userPersonLinks.userId, resident)),
    ).toHaveLength(1);
  });
  it("returns duplicate conflicts without partial writes and prevents stale overwrites", async () => {
    for (const value of [
      { entity: "building", name: "B" },
      { entity: "floor", buildingId: a, number: 5 },
      { entity: "apartment", floorId: f, number: "2" },
    ]) {
      const result = await call(value, admin);
      check(result, 409);
      expect(await result.json()).toEqual({ error: "DUPLICATE_STRUCTURE" });
    }
    check(
      await call({ entity: "apartment", id: unit, number: "2", expected: "Studio" }, bm, true),
      409,
    );
    const stale = await call(
      { entity: "apartment", id: unit, number: "Overwrite", expected: "1" },
      bm,
      true,
    );
    check(stale, 409);
    expect(await stale.json()).toEqual({ error: "STALE_STRUCTURE" });
    const [row] = await fixture.db.select().from(s.apartments).where(eq(s.apartments.id, unit));
    expect(row.number).toBe("Studio");
    const requests = await Promise.all([
      call({ entity: "floor", buildingId: a, number: 8 }, admin),
      call({ entity: "floor", buildingId: a, number: 8 }, pm),
    ]);
    expect(requests.map((r) => r.status).sort()).toEqual([201, 409]);
    const updates = await Promise.all([
      call({ entity: "floor", id: f, number: 6, expected: 5 }, admin, true),
      call({ entity: "floor", id: f, number: 7, expected: 5 }, pm, true),
    ]);
    expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it("rejects forged parents, moves, global project edits, missing identifiers and foreign origins", async () => {
    for (const input of [
      { entity: "apartment", floorId: f, buildingId: b, number: "Bad" },
      { entity: "project", name: "Bad" },
      { entity: "floor", buildingId: a, number: 1.5 },
    ])
      check(await call(input, admin), 400);
    check(
      await call(
        { entity: "apartment", id: unit, number: "Bad", expected: "Studio", floorId: otherFloor },
        admin,
        true,
      ),
      400,
    );
    for (const id of [crypto.randomUUID(), "bad"])
      check(await call({ entity: "building", name: "Bad" }, admin, false, id), 404);
    for (const origin of ["", "https://evil.test"])
      for (const update of [false, true])
        check(await call({ entity: "building", name: "Bad" }, admin, update, project, origin), 403);
  });
  it("rechecks revoked global/staff roles and expired database sessions before mutation", async () => {
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.userId, bm));
    check(await call({ entity: "apartment", floorId: f, number: "Revoked" }, bm), 404);
    await fixture.db.delete(s.staffAssignments).where(eq(s.staffAssignments.userId, pm));
    check(await call({ entity: "building", name: "Revoked" }, pm), 404);
    await fixture.db.delete(s.globalRoles).where(eq(s.globalRoles.userId, admin));
    check(await call({ entity: "building", name: "Revoked" }, admin), 404);
    const signed = await (await fixture.auth.$context).test.login({ userId: mixed });
    await fixture.db
      .update(s.authSessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.authSessions.token, signed.token));
    const headers = new Headers(signed.headers);
    headers.set("origin", config.baseURL);
    headers.set("content-type", "application/json");
    check(
      await POST(
        new Request(config.baseURL, {
          method: "POST",
          headers,
          body: JSON.stringify({ entity: "building", name: "Expired" }),
        }),
        { params: Promise.resolve({ projectId: other }) },
      ),
      401,
    );
  });
});
