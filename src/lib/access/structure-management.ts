import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import {
  createManagedStructure,
  updateManagedStructure,
  type CreateManagedStructure,
  type UpdateManagedStructure,
} from "./structure-management-contracts";
type Database = PostgresJsDatabase<typeof s>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export class StructureManagementError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const unavailable = () => new StructureManagementError(404, "NOT_FOUND");
/** Grants are locked before structural writes, so revocation and mutation serialize. */
async function lockScope(tx: Transaction, actorId: string, projectId: string) {
  const admins = await tx
    .select({ role: s.globalRoles.role })
    .from(s.globalRoles)
    .where(and(eq(s.globalRoles.userId, actorId), eq(s.globalRoles.role, "admin")))
    .for("share");
  if (admins.length) return { all: true, buildings: [] as string[] };
  const grants = await tx
    .select({ role: s.staffAssignments.role, buildingId: s.staffAssignments.buildingId })
    .from(s.staffAssignments)
    .where(and(eq(s.staffAssignments.userId, actorId), eq(s.staffAssignments.projectId, projectId)))
    .orderBy(s.staffAssignments.id)
    .for("share");
  const all = grants.some((g) => g.role === "project_manager");
  const buildings = grants
    .filter((g) => g.role === "building_manager" && g.buildingId)
    .map((g) => g.buildingId!);
  if (!all && !buildings.length) throw unavailable();
  return { all, buildings };
}
async function lockBuilding(
  tx: Transaction,
  projectId: string,
  id: string,
  scope: Awaited<ReturnType<typeof lockScope>>,
) {
  const [building] = await tx
    .select({ id: s.buildings.id })
    .from(s.buildings)
    .where(
      and(
        eq(s.buildings.id, id),
        eq(s.buildings.projectId, projectId),
        scope.all ? undefined : inArray(s.buildings.id, scope.buildings),
      ),
    )
    .for("update");
  if (!building) throw unavailable();
}
type Scope = Awaited<ReturnType<typeof lockScope>>;
async function floorParent(tx: Transaction, scope: Scope, projectId: string, id: string) {
  const [row] = await tx
    .select({ buildingId: s.buildings.id, floorId: s.floors.id })
    .from(s.floors)
    .innerJoin(s.buildings, eq(s.buildings.id, s.floors.buildingId))
    .where(
      and(
        eq(s.floors.id, id),
        eq(s.buildings.projectId, projectId),
        scope.all ? undefined : inArray(s.buildings.id, scope.buildings),
      ),
    );
  if (!row) throw unavailable();
  return row;
}
async function apartmentParent(tx: Transaction, scope: Scope, projectId: string, id: string) {
  const [row] = await tx
    .select({ buildingId: s.buildings.id })
    .from(s.apartments)
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .where(
      and(
        eq(s.apartments.id, id),
        eq(s.buildings.projectId, projectId),
        scope.all ? undefined : inArray(s.buildings.id, scope.buildings),
      ),
    );
  if (!row) throw unavailable();
  return row;
}
async function withScope(
  db: Database,
  actorId: string,
  projectId: string,
  action: (tx: Transaction, scope: Scope) => Promise<{ id: string }>,
) {
  try {
    return await db.transaction(async (tx) => action(tx, await lockScope(tx, actorId, projectId)));
  } catch (error) {
    const driver = error instanceof Error && "cause" in error ? error.cause : error;
    if (driver && typeof driver === "object" && "code" in driver && driver.code === "23505")
      throw new StructureManagementError(409, "DUPLICATE_STRUCTURE");
    throw error;
  }
}
export function createManagementStructure(
  db: Database,
  actorId: string,
  projectId: string,
  value: CreateManagedStructure,
) {
  const input = createManagedStructure.parse(value);
  return withScope(db, actorId, projectId, async (tx, scope) => {
    switch (input.entity) {
      case "building": {
        if (!scope.all) throw unavailable();
        const [project] = await tx
          .select({ id: s.projects.id })
          .from(s.projects)
          .where(eq(s.projects.id, projectId))
          .for("key share");
        if (!project) throw unavailable();
        const [row] = await tx
          .insert(s.buildings)
          .values({ projectId, name: input.name })
          .returning({ id: s.buildings.id });
        return row;
      }
      case "floor": {
        await lockBuilding(tx, projectId, input.buildingId, scope);
        const [row] = await tx
          .insert(s.floors)
          .values({ buildingId: input.buildingId, number: input.number })
          .returning({ id: s.floors.id });
        return row;
      }
      case "apartment": {
        const parent = await floorParent(tx, scope, projectId, input.floorId);
        await lockBuilding(tx, projectId, parent.buildingId, scope);
        const [row] = await tx
          .insert(s.apartments)
          .values({ buildingId: parent.buildingId, floorId: parent.floorId, number: input.number })
          .returning({ id: s.apartments.id });
        return row;
      }
    }
  });
}
export function updateManagementStructure(
  db: Database,
  actorId: string,
  projectId: string,
  value: UpdateManagedStructure,
) {
  const input = updateManagedStructure.parse(value);
  return withScope(db, actorId, projectId, async (tx, scope) => {
    let rows: { id: string }[];
    switch (input.entity) {
      case "building": {
        await lockBuilding(tx, projectId, input.id, scope);
        rows = await tx
          .update(s.buildings)
          .set({ name: input.name })
          .where(
            and(
              eq(s.buildings.id, input.id),
              eq(s.buildings.projectId, projectId),
              eq(s.buildings.name, input.expected),
            ),
          )
          .returning({ id: s.buildings.id });
        break;
      }
      case "floor": {
        const parent = await floorParent(tx, scope, projectId, input.id);
        await lockBuilding(tx, projectId, parent.buildingId, scope);
        rows = await tx
          .update(s.floors)
          .set({ number: input.number })
          .where(
            and(
              eq(s.floors.id, input.id),
              eq(s.floors.buildingId, parent.buildingId),
              eq(s.floors.number, input.expected),
            ),
          )
          .returning({ id: s.floors.id });
        break;
      }
      case "apartment": {
        const parent = await apartmentParent(tx, scope, projectId, input.id);
        await lockBuilding(tx, projectId, parent.buildingId, scope);
        rows = await tx
          .update(s.apartments)
          .set({ number: input.number })
          .where(
            and(
              eq(s.apartments.id, input.id),
              eq(s.apartments.buildingId, parent.buildingId),
              eq(s.apartments.number, input.expected),
            ),
          )
          .returning({ id: s.apartments.id });
        break;
      }
    }
    if (!rows.length) throw new StructureManagementError(409, "STALE_STRUCTURE");
    return rows[0];
  });
}
