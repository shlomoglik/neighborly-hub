import { z } from "zod";

const uuid = z.string().uuid();
const name = z.string().trim().min(1).max(200);

export const createStructure = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("project"), name, city: z.string().trim().max(200).nullable().optional() }),
  z.object({ entity: z.literal("building"), name, projectId: uuid }),
  z.object({ entity: z.literal("floor"), buildingId: uuid, number: z.number().int() }),
  z.object({ entity: z.literal("apartment"), buildingId: uuid, floorId: uuid, number: name }),
]);

export const updateStructure = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("project"), id: uuid, name, city: z.string().trim().max(200).nullable().optional() }),
  z.object({ entity: z.literal("building"), id: uuid, name }),
  z.object({ entity: z.literal("floor"), id: uuid, number: z.number().int() }),
  z.object({ entity: z.literal("apartment"), id: uuid, number: name }),
]);

export const deleteStructure = z.object({
  entity: z.enum(["project", "building", "floor", "apartment"]),
  id: uuid,
});
