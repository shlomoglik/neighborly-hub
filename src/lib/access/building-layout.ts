import "server-only";
import { and, eq, inArray, or, isNotNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { buildingLayoutInput, type BuildingLayoutInput } from "./building-layout-contracts";
import { buildingVersion } from "./building-version";
import { lockScope, lockBuilding, StructureManagementError } from "./structure-management";
/** All targets commit together; unrelated existing floors and apartment identities are preserved. */
export async function updateBuildingLayouts(
  db: PostgresJsDatabase<typeof s>,
  actorId: string,
  projectId: string,
  value: BuildingLayoutInput,
) {
  const input = buildingLayoutInput.parse(value);
  return db.transaction(async (tx) => {
    const scope = await lockScope(tx, actorId, projectId);
    // Match the lock order of all structural writers and avoid cross-building deadlocks.
    for (const building of [...input.buildings].sort((a, b) => a.id.localeCompare(b.id)))
      await lockBuilding(tx, projectId, building.id, scope);
    const collator = new Intl.Collator("en", { numeric: true });
    let added = 0,
      removed = 0;
    for (const target of input.buildings) {
      const [building] = await tx.select().from(s.buildings).where(eq(s.buildings.id, target.id));
      const floors = await tx
        .select()
        .from(s.floors)
        .where(eq(s.floors.buildingId, target.id))
        .orderBy(s.floors.id);
      const apartments = await tx
        .select()
        .from(s.apartments)
        .where(eq(s.apartments.buildingId, target.id))
        .orderBy(s.apartments.id)
        .for("update");
      const current = {
        ...building,
        floors: floors.map((f) => ({
          ...f,
          apartments: apartments.filter((a) => a.floorId === f.id),
        })),
      };
      // Hash only the public shape, never driver-specific columns or timestamps.
      const version = buildingVersion({
        id: current.id,
        name: current.name,
        address: current.address,
        floors: current.floors.map((f) => ({
          id: f.id,
          number: f.number,
          apartments: f.apartments.map((a) => ({ id: a.id, number: a.number })),
        })),
      });
      if (version !== target.expectedVersion)
        throw new StructureManagementError(409, "STALE_STRUCTURE");
      const used = new Set(apartments.map((a) => a.number));
      let nextNumber = 1;
      for (const desired of target.floors) {
        if (!floors.some((f) => f.id === desired.id))
          throw new StructureManagementError(404, "NOT_FOUND");
        const units = apartments
          .filter((a) => a.floorId === desired.id)
          .sort((a, b) => collator.compare(a.number, b.number) || a.id.localeCompare(b.id));
        if (desired.units < units.length) {
          const ids = units.slice(desired.units).map((a) => a.id);
          // Never cascade-delete households, ownership, invitations or join requests.
          const refs = await tx
            .select({ id: s.apartments.id })
            .from(s.apartments)
            .leftJoin(s.households, eq(s.households.apartmentId, s.apartments.id))
            .leftJoin(s.apartmentOwnerships, eq(s.apartmentOwnerships.apartmentId, s.apartments.id))
            .leftJoin(s.invitations, eq(s.invitations.apartmentId, s.apartments.id))
            .leftJoin(s.joinRequests, eq(s.joinRequests.apartmentId, s.apartments.id))
            .where(
              and(
                inArray(s.apartments.id, ids),
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
          await tx.delete(s.apartments).where(inArray(s.apartments.id, ids));
          removed += ids.length;
        } else if (desired.units > units.length) {
          const values = Array.from({ length: desired.units - units.length }, () => {
            while (used.has(String(nextNumber))) nextNumber++;
            const number = String(nextNumber++);
            used.add(number);
            return { buildingId: target.id, floorId: desired.id, number };
          });
          await tx.insert(s.apartments).values(values);
          added += values.length;
        }
      }
    }
    return { added, removed };
  });
}
