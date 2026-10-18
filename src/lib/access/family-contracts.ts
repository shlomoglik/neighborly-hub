import { z } from "zod";
const profile = z
  .object({
    name: z.string().trim().min(1).max(200),
    relation: z.string().trim().max(100).nullable(),
  })
  .strict();
const expected = z
  .object({ name: z.string().max(1000), relation: z.string().max(1000).nullable() })
  .strict();
export const familyMutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("addChild"), requestId: z.string().uuid(), profile }).strict(),
  z.object({ action: z.literal("updateChild"), id: z.string().uuid(), profile, expected }).strict(),
  z.object({ action: z.literal("removeChild"), id: z.string().uuid(), expected }).strict(),
]);
export type FamilyMutation = z.infer<typeof familyMutation>;
export type FamilyMember = {
  id: string;
  name: string;
  relation: string | null;
  child: boolean;
  representative: boolean;
  editable: boolean;
};
export type FamilyPage = {
  id: string;
  name: string;
  projectName: string;
  members: FamilyMember[];
  page: number;
  hasNext: boolean;
  canAdd: boolean;
};
