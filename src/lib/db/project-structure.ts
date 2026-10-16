import "server-only";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../../../drizzle/schema";
import { apartments, buildings, floors, projects } from "../../../drizzle/schema";
import type { ProjectStructureInput } from "./project-structure-input";

export type StructureDatabase = PostgresJsDatabase<typeof schema>;
/**
 * Creates a project and its entire building hierarchy atomically.
 * PostgreSQL constraints reject duplicate building, floor, or apartment numbers.
 */
export async function createProjectStructure(
  input: ProjectStructureInput,
  database?: StructureDatabase,
) {
  const db = database ?? (await import("./client")).db;
  return db.transaction((tx) => insertProjectStructure(tx, input));
}

/** Internal writer: caller owns the transaction and authorization boundary. */
export async function insertProjectStructure(
  tx: Pick<StructureDatabase, "insert">,
  input: ProjectStructureInput,
) {
  const [project] = await tx
    .insert(projects)
    .values({ name: input.name, city: input.city })
    .returning({ id: projects.id });

  for (const buildingInput of input.buildings) {
    const [building] = await tx
      .insert(buildings)
      .values({ projectId: project.id, name: buildingInput.name })
      .returning({ id: buildings.id });

    for (const floorInput of buildingInput.floors) {
      const [floor] = await tx
        .insert(floors)
        .values({ buildingId: building.id, number: floorInput.number })
        .returning({ id: floors.id });

      if (floorInput.apartments.length > 0) {
        await tx.insert(apartments).values(
          floorInput.apartments.map((apartment) => ({
            buildingId: building.id,
            floorId: floor.id,
            number: apartment.number,
          })),
        );
      }
    }
  }

  return { projectId: project.id };
}
