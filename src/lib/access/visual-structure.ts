import "server-only";
import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import * as s from "../../../drizzle/schema";
import type { StructureDatabase } from "../db/project-structure";
import { buildingVersion } from "./building-version";
import { lockBuilding, lockScope, StructureManagementError } from "./structure-management";
import { visualBuildingInput, type VisualBuildingInput } from "./visual-structure-contracts";
/** The supplied building is a full snapshot; identities are preserved across renames and moves. */
export async function saveVisualBuilding(
  db: StructureDatabase,
  actor: string,
  projectId: string,
  value: VisualBuildingInput,
) {
  const input = visualBuildingInput.parse(value);
  try {
    return await db.transaction(async (tx) => {
      const scope = await lockScope(tx, actor, projectId);
      await lockBuilding(tx, projectId, input.id, scope);
      const [building] = await tx.select().from(s.buildings).where(eq(s.buildings.id, input.id));
      const floors = await tx
        .select()
        .from(s.floors)
        .where(eq(s.floors.buildingId, input.id))
        .for("update");
      const units = await tx
        .select()
        .from(s.apartments)
        .where(eq(s.apartments.buildingId, input.id))
        .for("update");
      const current = {
        ...building,
        floors: floors.map((f) => ({ ...f, apartments: units.filter((u) => u.floorId === f.id) })),
      };
      if (buildingVersion(current) !== input.expectedVersion)
        throw new StructureManagementError(409, "STALE_STRUCTURE");
      const retained = new Set(input.floors.flatMap((f) => f.apartments.map((u) => u.id)));
      const removed = units.filter((u) => !retained.has(u.id)).map((u) => u.id);
      if (removed.length) {
        const refs = await tx
          .select({ id: s.apartments.id })
          .from(s.apartments)
          .leftJoin(s.households, eq(s.households.apartmentId, s.apartments.id))
          .leftJoin(s.apartmentOwnerships, eq(s.apartmentOwnerships.apartmentId, s.apartments.id))
          .leftJoin(s.invitations, eq(s.invitations.apartmentId, s.apartments.id))
          .leftJoin(s.joinRequests, eq(s.joinRequests.apartmentId, s.apartments.id))
          .where(
            and(
              inArray(s.apartments.id, removed),
              or(
                isNotNull(s.households.id),
                isNotNull(s.apartmentOwnerships.id),
                isNotNull(s.invitations.id),
                isNotNull(s.joinRequests.id),
              ),
            ),
          )
          .limit(1);
        if (refs.length) throw new StructureManagementError(409, "LINKED_APARTMENTS");
        await tx.delete(s.apartments).where(inArray(s.apartments.id, removed));
      }
      // Vacate unique labels/levels while swapping; all intermediate states stay inside this transaction.
      const usedLevels = new Set([
        ...floors.map((f) => f.number),
        ...input.floors.map((f) => f.number),
      ]);
      let temporaryLevel = -2147483648;
      for (const f of floors) {
        while (usedLevels.has(temporaryLevel)) temporaryLevel++;
        usedLevels.add(temporaryLevel);
        await tx.update(s.floors).set({ number: temporaryLevel++ }).where(eq(s.floors.id, f.id));
      }
      for (const u of units.filter((u) => retained.has(u.id)))
        await tx
          .update(s.apartments)
          .set({ number: `__editing_${u.id}` })
          .where(eq(s.apartments.id, u.id));
      for (const f of input.floors) {
        const values = { number: f.number, name: f.name ?? null, type: f.type };
        if (floors.some((x) => x.id === f.id))
          await tx.update(s.floors).set(values).where(eq(s.floors.id, f.id));
        else await tx.insert(s.floors).values({ ...values, id: f.id, buildingId: input.id });
        for (const [position, u] of f.apartments.entries()) {
          const values = { number: u.number, type: u.type ?? f.type, position, floorId: f.id };
          if (units.some((x) => x.id === u.id))
            await tx.update(s.apartments).set(values).where(eq(s.apartments.id, u.id));
          else await tx.insert(s.apartments).values({ ...values, id: u.id, buildingId: input.id });
        }
      }
      const removedFloors = floors
        .filter((f) => !input.floors.some((x) => x.id === f.id))
        .map((f) => f.id);
      if (removedFloors.length)
        await tx.delete(s.floors).where(inArray(s.floors.id, removedFloors));
      await tx
        .update(s.buildings)
        .set({ name: input.name, address: input.address || null })
        .where(eq(s.buildings.id, input.id));
      return { id: input.id };
    });
  } catch (error) {
    const driver = error instanceof Error && "cause" in error ? error.cause : error;
    if (driver && typeof driver === "object" && "code" in driver && driver.code === "23505")
      throw new StructureManagementError(409, "DUPLICATE_STRUCTURE");
    throw error;
  }
}
