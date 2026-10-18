import { z } from "zod";

const name = z.string().trim().min(1).max(200);
const apartment = z.object({ number: name });
const floor = z.object({
  number: z.number().int(),
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
