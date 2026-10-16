import { z } from "zod";

const name = z.string().trim().min(1).max(200);

const building = z.object({
  name,
  floors: z.number().int().min(1).max(200),
  unitsPerFloor: z.number().int().min(1).max(200),
});

export const projectSetupInput = z
  .object({
    name,
    city: z.string().trim().min(1).max(200),
    buildings: z.array(building).min(1).max(100),
  })
  .superRefine((input, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of input.buildings.entries()) {
      const key = item.name.toLocaleLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buildings", index, "name"],
          message: "Duplicate building name",
        });
      }
      seen.add(key);
    }
  });

export type ProjectSetupInput = z.infer<typeof projectSetupInput>;
