import { z } from "zod";
const uuid = z.string().uuid();
const recipientEmail = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((v) => v.toLowerCase())
  .optional();
const expiresInDays = z.number().int().min(1).max(90).default(7);
export const invitationInput = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("resident"),
      buildingId: uuid,
      apartmentId: uuid.nullable(),
      recipientEmail,
      expiresInDays,
    })
    .strict(),
  z
    .object({
      kind: z.literal("project_manager"),
      recipientEmail: recipientEmail.unwrap(),
      expiresInDays,
    })
    .strict(),
  z
    .object({
      kind: z.literal("building_manager"),
      buildingId: uuid,
      recipientEmail: recipientEmail.unwrap(),
      expiresInDays,
    })
    .strict(),
]);
export type InvitationInput = z.infer<typeof invitationInput>;
export type InvitationKind = InvitationInput["kind"] | "household_member";
export const householdInvitationInput = z.object({ recipientEmail, expiresInDays }).strict();
export type HouseholdInvitationInput = z.infer<typeof householdInvitationInput>;
export const joinInput = z.union([
  z
    .object({
      apartmentId: uuid,
      fullName: z.string().trim().min(1).max(200),
      householdName: z.string().trim().min(1).max(200),
    })
    .strict(),
  z.object({ fullName: z.string().trim().min(1).max(200) }).strict(),
  z.object({}).strict(),
]);
export type JoinInput = z.infer<typeof joinInput>;
export const reviewInput = z.object({ decision: z.enum(["approve", "reject"]) }).strict();
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const invitationPageSize = 20;
export type InvitationItem = {
  id: string;
  kind: InvitationKind;
  buildingId: string | null;
  apartmentId: string | null;
  recipientEmail: string | null;
  expiresAt: string;
  revoked: boolean;
  consumed: boolean;
};
export type RequestItem = {
  id: string;
  kind: InvitationKind;
  projectId: string;
  projectName: string;
  buildingName: string | null;
  apartmentNumber: string | null;
  fullName: string | null;
  householdName: string | null;
  status: "pending" | "approved" | "rejected";
  accountName: string;
  accountEmail: string;
  invitationActive: boolean;
  canReview: boolean;
};
export type InvitationPage = {
  invitations: InvitationItem[];
  page: number;
  hasNext: boolean;
  canInviteStaff: boolean;
};
export type RequestPage = { requests: RequestItem[]; page: number; hasNext: boolean };
export type JoinContext = {
  projectName: string;
  kind: InvitationKind;
  buildingName: string | null;
  fixedApartmentId: string | null;
  apartments: { id: string; number: string; floor: number }[];
  page: number;
  hasNext: boolean;
  request: { id: string; status: RequestItem["status"] } | null;
  active: boolean;
};
export const invitationAdminHref = (id: string) => `/manage/invitations/${encodeURIComponent(id)}`;
