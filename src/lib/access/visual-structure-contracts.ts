import { z } from "zod";
import { detailedFloor, setupBuildingsInput } from "../db/project-setup-input";
import { structureUnit } from "../db/project-structure-input";
export const visualBuildingInput = z
  .object({
    id: z.string().uuid(),
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500),
    floors: z
      .array(
        detailedFloor.extend({
          id: z.string().uuid(),
          apartments: z.array(structureUnit.extend({ id: z.string().uuid() })).max(200),
        }),
      )
      .min(1)
      .max(200),
  })
  .strict()
  .superRefine((b, ctx) => {
    const parsed = setupBuildingsInput.safeParse([
      {
        name: b.name,
        floors: b.floors.length,
        unitsPerFloor: 1,
        structure: b.floors.map(({ id: _id, apartments, ...f }) => ({
          ...f,
          apartments: apartments.map(({ id: _id, ...u }) => u),
        })),
      },
    ]);
    if (!parsed.success)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid building layout" });
    const ids = b.floors.flatMap((f) => [f.id, ...f.apartments.map((a) => a.id)]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate identity" });
  });
export type VisualBuildingInput = z.infer<typeof visualBuildingInput>;

export const visualProjectInput = z
  .object({
    action: z.literal("saveProjectStructure"),
    buildings: z.array(visualBuildingInput).min(1).max(100),
  })
  .strict()
  .superRefine(({ buildings }, ctx) => {
    const ids = buildings.flatMap((b) => [
      b.id,
      ...b.floors.flatMap((f) => [f.id, ...f.apartments.map((u) => u.id)]),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate structure identity" });
    if (
      buildings.reduce((n, b) => n + b.floors.length, 0) > 1000 ||
      buildings.reduce((n, b) => n + b.floors.reduce((sum, f) => sum + f.apartments.length, 0), 0) >
        10000
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Structure exceeds operation capacity",
      });
  });
export type VisualProjectInput = z.infer<typeof visualProjectInput>;
