import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../../drizzle/schema";
vi.mock("server-only", () => ({}));
import { readDirectory } from "./directory";
const url = process.env.AUTH_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL resident authorization", () => {
  const ids = Array.from({ length: 20 }, () => crypto.randomUUID());
  const [
    admin,
    resident,
    pending,
    manager,
    outsider,
    project,
    otherProject,
    a,
    b,
    floorA,
    floorB,
    aptA,
    aptB,
    homeA,
    homeB,
    personA,
    personB,
    child,
    pendingPerson,
  ] = ids;
  let client: ReturnType<typeof postgres>;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  beforeAll(async () => {
    client = postgres(url!, { max: 1 });
    db = drizzle(client, { schema });
    await db.insert(schema.appUsers).values(
      [admin, resident, pending, manager, outsider].map((id) => ({
        id,
        email: `${id}@example.test`,
      })),
    );
    await db.insert(schema.projects).values([
      { id: project, name: "Access fixture" },
      { id: otherProject, name: "Other fixture" },
    ]);
    await db.insert(schema.buildings).values([
      { id: a, projectId: project, name: "A" },
      { id: b, projectId: project, name: "B" },
    ]);
    await db.insert(schema.floors).values([
      { id: floorA, buildingId: a, number: 1 },
      { id: floorB, buildingId: b, number: 1 },
    ]);
    await db.insert(schema.apartments).values([
      { id: aptA, buildingId: a, floorId: floorA, number: "1" },
      { id: aptB, buildingId: b, floorId: floorB, number: "1" },
    ]);
    await db.insert(schema.households).values([
      {
        id: homeA,
        apartmentId: aptA,
        displayName: "A",
        approvalStatus: "approved",
        createdBy: outsider,
      },
      { id: homeB, apartmentId: aptB, displayName: "B", approvalStatus: "pending" },
    ]);
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.parties)
        .values([personA, personB, child, pendingPerson].map((id) => ({ id, kind: "person" })));
      await tx.insert(schema.people).values(
        [personA, personB, child, pendingPerson].map((id) => ({
          partyId: id,
          fullName: id === child ? "PRIVATE CHILD" : id,
          isChild: id === child,
        })),
      );
    });
    await db.insert(schema.householdMembers).values([
      { householdId: homeA, personId: personA },
      { householdId: homeA, personId: child },
      { householdId: homeB, personId: personB },
      { householdId: homeB, personId: pendingPerson },
    ]);
    await db.insert(schema.userPersonLinks).values([
      { userId: resident, personId: personA, verifiedBy: admin },
      { userId: pending, personId: pendingPerson, verifiedBy: admin },
    ]);
    await db
      .insert(schema.staffAssignments)
      .values({ userId: manager, projectId: project, buildingId: a, role: "building_manager" });
    await db.insert(schema.contactMethods).values(
      [personA, personB, child].flatMap((partyId) =>
        ["project", "building", "managers"].map((visibility) => ({
          partyId,
          kind: "phone",
          value: `${partyId}:${visibility}`,
          visibility,
        })),
      ),
    );
  });
  afterAll(async () => {
    if (!client) return;
    try {
      await client`DELETE FROM user_person_links WHERE user_id IN ${client([resident, pending])}`;
      await client`DELETE FROM projects WHERE id IN ${client([project, otherProject])}`;
      await client`DELETE FROM parties WHERE id IN ${client([personA, personB, child, pendingPerson])}`;
      await client`DELETE FROM app_users WHERE id IN ${client([admin, resident, pending, manager, outsider])}`;
    } finally {
      await client.end();
    }
  });
  it("denies missing links, pending residents and household creators", async () => {
    expect(await readDirectory(db, outsider, project)).toBeNull();
    expect(await readDirectory(db, pending, project)).toBeNull();
  });
  it("filters children, unapproved households, private contacts and internal fields", async () => {
    const result = await readDirectory(db, resident, project);
    expect(result?.residents).toHaveLength(1);
    expect(result?.residents[0].contacts.map((c) => c.value)).toEqual(
      expect.arrayContaining([`${personA}:project`, `${personA}:building`]),
    );
    expect(result?.residents[0].contacts).toHaveLength(2);
    const body = JSON.stringify(result);
    expect(body).not.toContain("PRIVATE CHILD");
    expect(body).not.toContain(":managers");
    expect(body).not.toContain("birthDate");
    expect(body).not.toContain("createdBy");
  });
  it("never crosses project boundaries, including scoped managers", async () => {
    expect(await readDirectory(db, resident, otherProject)).toBeNull();
    expect(await readDirectory(db, manager, otherProject)).toBeNull();
  });
  it("rechecks approval and settings on every read", async () => {
    await client`UPDATE households SET approval_status = 'approved' WHERE id = ${homeB}`;
    let result = await readDirectory(db, resident, project);
    expect(result?.residents).toHaveLength(3);
    expect(
      result?.residents.find((r) => r.personId === personB)?.contacts.map((c) => c.value),
    ).toEqual([`${personB}:project`]);
    await client`UPDATE projects SET directory_visibility = 'building' WHERE id = ${project}`;
    result = await readDirectory(db, resident, project);
    expect(result?.residents).toHaveLength(1);
    await client`UPDATE households SET approval_status = 'rejected' WHERE id = ${homeA}`;
    expect(await readDirectory(db, resident, project)).toBeNull();
    await client`UPDATE households SET approval_status = 'approved' WHERE id = ${homeA}`;
  });
  it("allows managers private contacts only inside their assigned building", async () => {
    const result = await readDirectory(db, manager, project);
    expect(result?.residents).toHaveLength(1);
    expect(result?.residents[0].contacts).toHaveLength(3);
    await client`DELETE FROM staff_assignments WHERE user_id = ${manager}`;
    expect(await readDirectory(db, manager, project)).toBeNull();
  });
  it("supports scoped project managers and global admins without crossing their grants", async () => {
    await db
      .insert(schema.staffAssignments)
      .values({ userId: manager, projectId: project, role: "project_manager" });
    expect((await readDirectory(db, manager, project))?.residents).toHaveLength(3);
    expect(await readDirectory(db, manager, otherProject)).toBeNull();
    await db.insert(schema.globalRoles).values({ userId: admin, role: "admin" });
    expect(await readDirectory(db, admin, otherProject)).toEqual({ residents: [] });
    expect(
      (await readDirectory(db, admin, project))?.residents.find((r) => r.personId === personB)
        ?.contacts.length,
    ).toBe(3);
  });
  it("combines residency and staff grants without widening manager-only contacts", async () => {
    await client`UPDATE projects SET directory_visibility = 'community' WHERE id = ${project}`;
    await db
      .insert(schema.staffAssignments)
      .values({ userId: resident, projectId: project, buildingId: b, role: "building_manager" });
    const result = await readDirectory(db, resident, project);
    expect(result?.residents.find((r) => r.personId === personA)?.contacts).toHaveLength(2);
    expect(result?.residents.find((r) => r.personId === personB)?.contacts).toHaveLength(3);
    await client`DELETE FROM staff_assignments WHERE user_id = ${resident}`;
    expect(
      (await readDirectory(db, resident, project))?.residents.find((r) => r.personId === personB)
        ?.contacts,
    ).toHaveLength(1);
    await client`UPDATE projects SET directory_visibility = 'building' WHERE id = ${project}`;
  });
  it("revokes resident access when the household becomes inactive", async () => {
    await client`UPDATE households SET is_active = false WHERE id = ${homeA}`;
    expect(await readDirectory(db, resident, project)).toBeNull();
    await client`UPDATE households SET is_active = true WHERE id = ${homeA}`;
  });
  it("enforces identity uniqueness, verifier provenance and referential integrity", async () => {
    await expect(
      db
        .insert(schema.userPersonLinks)
        .values({ userId: outsider, personId: personA, verifiedBy: admin }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.userPersonLinks)
        .values({ userId: outsider, personId: personB, verifiedBy: outsider }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(schema.userPersonLinks)
        .values({ userId: outsider, personId: crypto.randomUUID(), verifiedBy: admin }),
    ).rejects.toThrow();
    await client`DELETE FROM user_person_links WHERE user_id = ${resident}`;
    expect(await readDirectory(db, resident, project)).toBeNull();
  });
});
