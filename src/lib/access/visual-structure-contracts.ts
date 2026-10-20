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
