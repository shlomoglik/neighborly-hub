import "server-only";
import { asc, eq } from "drizzle-orm";
import { apartments, buildings, floors, projects } from "../../../drizzle/schema";
import { db } from "./client";
import { toBuildingHierarchy } from "./building-hierarchy-model";

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
