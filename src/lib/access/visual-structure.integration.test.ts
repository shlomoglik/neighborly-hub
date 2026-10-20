import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as s from "../../../drizzle/schema";
import { createProjectStructure } from "../db/project-structure";
import { provisionProjectSetup } from "./project-setup";
import { readManagementHierarchy } from "./management";
import { saveVisualBuilding } from "./visual-structure";
import { visualBuildingInput } from "./visual-structure-contracts";
vi.mock("server-only", () => ({}));
const url = process.env.AUTH_TEST_DATABASE_URL;
describe.skipIf(!url)("visual structure persistence and authorization", () => {
  const client = postgres(url ?? "postgres://unused", { max: 3 });
  const db = drizzle(client, { schema: s });
  const admin = crypto.randomUUID(),
    resident = crypto.randomUUID();
  const projects: string[] = [];
  let projectId: string;
  beforeAll(async () => {
    await db.insert(s.appUsers).values([
      { id: admin, email: `${admin}@example.test` },
      { id: resident, email: `${resident}@example.test` },
    ]);
    await db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    ({ projectId } = await createProjectStructure(
      {
        name: "Visual test",
        buildings: [
          {
            name: "A",
            floors: [
              {
                number: -1,
                type: "parking",
                apartments: [
                  { number: "P-B", type: "parking" },
                  { number: "P-A", type: "parking" },
                ],
              },
              { number: 0, type: "commercial", apartments: [] },
            ],
          },
        ],
      },
      db,
    ));
    projects.push(projectId);
  });
  afterAll(async () => {
    for (const id of projects) await db.delete(s.projects).where(eq(s.projects.id, id));
    for (const id of [admin, resident]) await db.delete(s.appUsers).where(eq(s.appUsers.id, id));
    await client.end();
  });
  // Build strict write payload explicitly rather than forwarding read-only fields.
  const input = async () => {
    const b = (await readManagementHierarchy(db, admin, projectId))!.buildings[0];
    return visualBuildingInput.parse({
      id: b.id,
      name: b.name,
      address: b.address ?? "",
      expectedVersion: b.version,
      floors: b.floors.map((f) => ({
        id: f.id,
        number: f.number,
        name: f.name ?? undefined,
        type: f.type,
        apartments: f.apartments.map((a) => ({ id: a.id, number: a.number, type: a.type })),
      })),
    });
  };
  it("creates named units and reads the persisted display order", async () => {
    const r = await provisionProjectSetup(db, admin, {
      name: "Explicit",
      city: "Sderot",
      buildings: [
        {
          name: "B",
          floors: 1,
          unitsPerFloor: 1,
          structure: [
            {
              number: 0,
              type: "commercial",
              apartments: [
                { number: "25B", type: "commercial" },
                { number: "25A", type: "commercial" },
              ],
            },
          ],
        },
      ],
    });
    projects.push(r!.projectId);
    const h = (await readManagementHierarchy(db, admin, r!.projectId))!;
    expect(h.buildings[0].floors[0].apartments.map((a) => a.number)).toEqual(["25B", "25A"]);
  });
  it("atomically swaps labels and levels, preserves IDs and detects stale writes", async () => {
    const before = await input();
    const desired = structuredClone(before);
    desired.floors[0].number = 0;
    desired.floors[1].number = -1;
    desired.floors[0].apartments.reverse();
    await saveVisualBuilding(db, admin, projectId, desired);
    const after = await input();
    expect(
      after.floors.find((f) => f.id === before.floors[0].id)!.apartments.map((a) => a.id),
    ).toEqual(before.floors[0].apartments.map((a) => a.id).reverse());
    await expect(saveVisualBuilding(db, admin, projectId, before)).rejects.toMatchObject({
      code: "STALE_STRUCTURE",
    });
  });
  it("rejects resident writes and cross-project building IDs", async () => {
    const desired = await input();
    await expect(saveVisualBuilding(db, resident, projectId, desired)).rejects.toMatchObject({
      status: 404,
    });
    await expect(saveVisualBuilding(db, admin, crypto.randomUUID(), desired)).rejects.toMatchObject(
      { status: 404 },
    );
  });
  it("keeps linked households safe while permitting rename and move", async () => {
    let desired = await input();
    const source = desired.floors.find((f) => f.apartments.length)!;
    const linked = source.apartments[0];
    await db
      .insert(s.households)
      .values({ apartmentId: linked.id, displayName: "Linked household" });
    const deletion = structuredClone(desired);
    deletion.floors = deletion.floors.map((f) => ({
      ...f,
      apartments: f.apartments.filter((u) => u.id !== linked.id),
    }));
    await expect(saveVisualBuilding(db, admin, projectId, deletion)).rejects.toMatchObject({
      code: "LINKED_APARTMENTS",
    });
    desired = await input();
    const unit = desired.floors.flatMap((f) => f.apartments).find((u) => u.id === linked.id)!;
    for (const f of desired.floors) f.apartments = f.apartments.filter((u) => u.id !== linked.id);
    desired.floors
      .find((f) => f.id !== source.id)!
      .apartments.push({ ...unit, number: "Studio-X" });
    await saveVisualBuilding(db, admin, projectId, desired);
    const [household] = await db
      .select()
      .from(s.households)
      .where(eq(s.households.apartmentId, linked.id));
    expect(household).toBeTruthy();
  });
});
