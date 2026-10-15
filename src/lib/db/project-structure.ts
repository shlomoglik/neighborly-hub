import "server-only";
import { apartments, buildings, floors, projects } from "../../../drizzle/schema";
import { db } from "./client";
import type { ProjectStructureInput } from "./project-structure-input";

/**
 * Creates a project and its entire building hierarchy atomically.
 * PostgreSQL constraints reject duplicate building, floor, or apartment numbers.
 */
export async function createProjectStructure(input: ProjectStructureInput) {
  return db.transaction(async (tx) => {
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
  });
}
