import { z } from "zod";
export const staffInput = z.discriminatedUnion("role", [
  z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      role: z.literal("project_manager"),
      buildingId: z.null(),
    })
    .strict(),
  z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      role: z.literal("building_manager"),
      buildingId: z.string().uuid(),
    })
    .strict(),
]);
export type StaffInput = z.infer<typeof staffInput>;
export type StaffAssignment = {
  id: string;
  name: string;
  email: string;
  role: "project_manager" | "building_manager";
  buildingId: string | null;
};
export type StaffPage = {
  project: { id: string; name: string };
  buildings: { id: string; name: string }[];
  assignments: StaffAssignment[];
  page: number;
  hasNext: boolean;
};
export const staffHref = (projectId: string) => `/manage/staff/${encodeURIComponent(projectId)}`;

export type StaffRecipient = {
  account: "existing" | "new";
  role: "assigned" | "upgrade" | "available";
};
