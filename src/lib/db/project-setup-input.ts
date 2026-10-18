import { z } from "zod";
import type { ProjectStructureInput } from "./project-structure-input";

export const MAX_SETUP_BUILDINGS = 100;
export const MAX_SETUP_FLOORS = 1000;
export const MAX_SETUP_APARTMENTS = 10000;
const name = z.string().trim().min(1).max(200);

const building = z
  .object({
    name,
    address: z.string().trim().max(500).optional(),
    floorUnits: z.array(z.number().int().min(0).max(200)).max(200).optional(),
    floors: z.number().int().min(1).max(200),
    unitsPerFloor: z.number().int().min(1).max(200),
  })
  .strict();

export const projectSetupDetailsInput = z.object({ name, city: name });
export const setupBuildingsInput = z
  .array(building)
  .min(1)
  .max(MAX_SETUP_BUILDINGS)
  .superRefine((items, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      const key = item.name.normalize("NFKC").toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "name"],
          message: "Duplicate building name",
        });
      }
      seen.add(key);
      if (item.floorUnits && item.floorUnits.length !== item.floors)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "floorUnits"],
          message: "One unit count is required for each floor",
        });
    }
    if (
      items.reduce((n, item) => n + item.floors, 0) > MAX_SETUP_FLOORS ||
      items.reduce((n, item) => n + setupApartmentCount(item), 0) > MAX_SETUP_APARTMENTS
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Project exceeds setup capacity" });
    }
  });

export const projectSetupInput = projectSetupDetailsInput
  .extend({ buildings: setupBuildingsInput })
  .strict();
export type ProjectSetupInput = z.infer<typeof projectSetupInput>;
export const projectSetupResult = z.object({ projectId: z.string().uuid() });
export type ProjectSetupResult = z.infer<typeof projectSetupResult>;

export function setupFloorCounts(building: {
  floors: number;
  unitsPerFloor: number;
  floorUnits?: number[];
}) {
  return (
    building.floorUnits ??
    Array.from(
      { length: Math.max(0, Math.min(200, building.floors)) },
      () => building.unitsPerFloor,
    )
  );
}
export function setupApartmentCount(building: {
  floors: number;
  unitsPerFloor: number;
  floorUnits?: number[];
}) {
  return setupFloorCounts(building).reduce((total, units) => total + units, 0);
}
/** Floors start at ground floor 0; apartment numbers restart at 1 in each building. */
export function toProjectStructure(input: ProjectSetupInput): ProjectStructureInput {
  return {
    name: input.name,
    city: input.city,
    buildings: input.buildings.map((building) => {
      let number = 1;
      return {
        name: building.name,
        ...(building.address ? { address: building.address } : {}),
        floors: setupFloorCounts(building).map((units, floor) => ({
          number: floor,
          apartments: Array.from({ length: units }, () => ({ number: String(number++) })),
        })),
      };
    }),
  };
}
