import { z } from "zod";
export const buildingLayoutInput = z
  .object({
    buildings: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
            floors: z
              .array(
                z
                  .object({ id: z.string().uuid(), units: z.number().int().min(0).max(200) })
                  .strict(),
              )
              .min(1)
              .max(200),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine(({ buildings }, ctx) => {
    if (
      new Set(buildings.map((b) => b.id)).size !== buildings.length ||
      buildings.some((b) => new Set(b.floors.map((f) => f.id)).size !== b.floors.length)
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate layout targets" });
    if (
      buildings.reduce((n, b) => n + b.floors.length, 0) > 1000 ||
      buildings.reduce((n, b) => n + b.floors.reduce((n, f) => n + f.units, 0), 0) > 10000
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Layout exceeds operation capacity" });
  });
export type BuildingLayoutInput = z.infer<typeof buildingLayoutInput>;
