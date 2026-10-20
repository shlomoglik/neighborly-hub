import { z } from "zod";

const name = z.string().trim().min(1).max(200);
export const unitType = z.enum(["residential", "commercial", "parking"]);
export const structureUnit = z.object({ number: name, type: unitType.optional() }).strict();
const apartment = structureUnit;
const floor = z.object({
  number: z.number().int().min(-2147483648).max(2147483647),
  name: name.optional(),
  type: unitType.optional(),
  apartments: z.array(apartment),
});
const building = z.object({
  name,
  address: z.string().trim().max(500).nullable().optional(),
  floors: z.array(floor),
});

export const projectStructureInput = z.object({
  name,
  city: z.string().trim().max(200).nullable().optional(),
  buildings: z.array(building),
});

export type ProjectStructureInput = z.infer<typeof projectStructureInput>;
