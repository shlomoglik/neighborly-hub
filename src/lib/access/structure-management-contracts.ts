import { z } from "zod";
const uuid = z.string().uuid();
const label = z.string().trim().min(1).max(200);
const floorNumber = z.number().int().min(-2147483648).max(2147483647);
export const createManagedStructure = z.discriminatedUnion("entity", [
  z
    .object({
      entity: z.literal("building"),
      name: label,
      address: z.string().trim().max(500).optional(),
    })
    .strict(),
  z.object({ entity: z.literal("floor"), buildingId: uuid, number: floorNumber }).strict(),
  z.object({ entity: z.literal("apartment"), floorId: uuid, number: label }).strict(),
]);
export const updateManagedStructure = z.discriminatedUnion("entity", [
  z
    .object({
      entity: z.literal("building"),
      id: uuid,
      name: label,
      expected: z.string().min(1).max(200),
      address: z.string().trim().max(500).optional(),
      expectedAddress: z.string().max(500).nullable().optional(),
    })
    .strict(),
  z
    .object({ entity: z.literal("floor"), id: uuid, number: floorNumber, expected: floorNumber })
    .strict(),
  z
    .object({
      entity: z.literal("apartment"),
      id: uuid,
      number: label,
      expected: z.string().min(1).max(200),
    })
    .strict(),
]);
export type CreateManagedStructure = z.infer<typeof createManagedStructure>;
export type UpdateManagedStructure = z.infer<typeof updateManagedStructure>;
export type StructureEditTarget =
  | { mode: "create"; entity: "building" }
  | { mode: "create"; entity: "floor"; buildingId: string }
  | { mode: "create"; entity: "apartment"; floorId: string }
  | {
      mode: "update";
      entity: "building" | "apartment";
      id: string;
      expected: string;
      address?: string | null;
    }
  | { mode: "update"; entity: "floor"; id: string; expected: number };
