import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "./client";
import { apartments, buildings, floors, projects } from "../../../drizzle/schema";

/**
 * Internal read model for the residential structure.
 * Never expose this query through a public route without authorization.
 * It intentionally excludes households, ownership, and personal data.
 */
export async function getProjectStructure(projectId: string) {
  const [project] = await db
    .select({ id: projects.id, name: projects.name, city: projects.city })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;

  const rows = await db
    .select({
      buildingId: buildings.id,
      buildingName: buildings.name,
      floorId: floors.id,
      floorNumber: floors.number,
      apartmentId: apartments.id,
      apartmentNumber: apartments.number,
    })
    .from(buildings)
    .leftJoin(floors, eq(floors.buildingId, buildings.id))
    .leftJoin(apartments, eq(apartments.floorId, floors.id))
    .where(eq(buildings.projectId, projectId))
    .orderBy(asc(buildings.name), asc(floors.number), asc(apartments.number));

  return { ...project, buildings: toBuildingHierarchy(rows) };
}

export type StructureRow = {
  buildingId: string;
  buildingName: string;
  floorId: string | null;
  floorNumber: number | null;
  apartmentId: string | null;
  apartmentNumber: string | null;
};

export function toBuildingHierarchy(rows: readonly StructureRow[]) {
  const result: {
    id: string;
    name: string;
    floors: { id: string; number: number; apartments: { id: string; number: string }[] }[];
  }[] = [];
  const buildingById = new Map<string, (typeof result)[number]>();
  const floorById = new Map<string, (typeof result)[number]["floors"][number]>();

  for (const row of rows) {
    let building = buildingById.get(row.buildingId);
    if (!building) {
      building = { id: row.buildingId, name: row.buildingName, floors: [] };
      buildingById.set(row.buildingId, building);
      result.push(building);
    }

    if (row.floorId === null || row.floorNumber === null) continue;
    let floor = floorById.get(row.floorId);
    if (!floor) {
      floor = { id: row.floorId, number: row.floorNumber, apartments: [] };
      floorById.set(row.floorId, floor);
      building.floors.push(floor);
    }

    if (row.apartmentId !== null && row.apartmentNumber !== null) {
      floor.apartments.push({ id: row.apartmentId, number: row.apartmentNumber });
    }
  }

  return result;
}
