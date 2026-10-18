import { z } from "zod";

export const householdName = z.string().trim().min(1).max(100);
export const contactValue = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("phone"),
      value: z
        .string()
        .trim()
        .min(5)
        .max(40)
        .regex(/^\+?[0-9 ()-]+$/)
        .refine((value) => value.replace(/\D/g, "").length >= 5),
    })
    .strict(),
  z.object({ kind: z.literal("email"), value: z.string().trim().email().max(254) }).strict(),
]);
export const contactFields = z
  .object({
    kind: z.enum(["phone", "email"]),
    value: z.string().trim().min(1).max(254),
    label: z.string().trim().max(50).nullable(),
    visibility: z.enum(["managers", "building", "project"]),
  })
  .strict();
// Expected values preserve legacy whitespace; normalization applies only to new values.
const expectedContact = z
  .object({
    kind: z.enum(["phone", "email"]),
    value: z.string().max(1000),
    label: z.string().max(1000).nullable(),
    visibility: z.enum(["managers", "building", "project"]),
  })
  .strict();
const validContact = (c: z.infer<typeof contactFields>) =>
  contactValue.safeParse({ kind: c.kind, value: c.value }).success;
export const householdMutation = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("rename"), name: householdName, expected: z.string().max(1000) })
    .strict(),
  z
    .object({ action: z.literal("addContact"), contact: contactFields.refine(validContact) })
    .strict(),
  z
    .object({
      action: z.literal("updateContact"),
      id: z.string().uuid(),
      contact: contactFields.refine(validContact),
      expected: expectedContact,
    })
    .strict(),
  z
    .object({
      action: z.literal("deleteContact"),
      id: z.string().uuid(),
      expected: expectedContact,
    })
    .strict(),
]);
export type ContactFields = z.infer<typeof contactFields>;
export type HouseholdMutation = z.infer<typeof householdMutation>;
export type HouseholdSummary = {
  id: string;
  name: string;
  project: string;
  building: string;
  apartment: string;
};
export type HouseholdList = { households: HouseholdSummary[]; page: number; hasNext: boolean };
export type HouseholdDetail = HouseholdSummary & {
  floor: number;
  canRename: boolean;
  ownContacts: ({ id: string } & ContactFields)[] | null;
  members: {
    id: string;
    name: string;
    primary: boolean;
    contacts: { kind: "phone" | "email"; value: string }[];
  }[];
  page: number;
  hasNext: boolean;
};
