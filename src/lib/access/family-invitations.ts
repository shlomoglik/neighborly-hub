import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as s from "../../../drizzle/schema";
import { familyRepresentative, type FamilyDatabase } from "./family-access";
import {
  householdInvitationInput,
  type HouseholdInvitationInput,
  type InvitationPage,
} from "./invitation-contracts";
import { insertInvitation, rotateInvitation, InvitationError } from "./invitations";
import { managementPageSchema } from "./management-contracts";
import { HouseholdError } from "./households";
export async function createFamilyInvitation(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  value: HouseholdInvitationInput,
) {
  const input = householdInvitationInput.parse(value);
  return db.transaction(async (tx) => {
    const home = await familyRepresentative(tx, userId, householdId, "write");
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.invitations)
      .where(
        and(
          eq(s.invitations.householdId, householdId),
          sql`${s.invitations.revokedAt} is null`,
          sql`${s.invitations.expiresAt}>now()`,
        ),
      );
    if (count.n >= 20) throw new HouseholdError(409, "FAMILY_INVITE_LIMIT");
    return insertInvitation(
      tx,
      userId,
      {
        projectId: home.projectId,
        buildingId: home.buildingId,
        apartmentId: home.apartmentId,
        householdId,
        kind: "household_member",
      },
      input,
    );
  });
}
export async function listFamilyInvitations(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  page = 1,
): Promise<InvitationPage> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      await familyRepresentative(tx, userId, householdId);
      const rows = await tx
        .select({
          id: s.invitations.id,
          buildingId: s.invitations.buildingId,
          apartmentId: s.invitations.apartmentId,
          recipientEmail: s.invitations.recipientEmail,
          expiresAt: s.invitations.expiresAt,
          revokedAt: s.invitations.revokedAt,
          consumedAt: s.invitations.consumedAt,
        })
        .from(s.invitations)
        .where(
          and(
            eq(s.invitations.householdId, householdId),
            eq(s.invitations.kind, "household_member"),
          ),
        )
        .orderBy(s.invitations.createdAt, s.invitations.id)
        .limit(21)
        .offset((page - 1) * 20);
      return {
        invitations: rows.slice(0, 20).map((r) => ({
          id: r.id,
          kind: "household_member",
          buildingId: r.buildingId,
          apartmentId: r.apartmentId,
          recipientEmail: r.recipientEmail,
          expiresAt: r.expiresAt.toISOString(),
          revoked: !!r.revokedAt,
          consumed: !!r.consumedAt,
        })),
        page,
        hasNext: rows.length > 20 && page < 10000,
        canInviteStaff: false,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function revokeFamilyInvitation(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  id: string,
) {
  return db
    .transaction(async (tx) => {
      // The invitation is locked before issuer grants, matching the approval/revocation order.
      const [invite] = await tx
        .select({ id: s.invitations.id })
        .from(s.invitations)
        .where(
          and(
            eq(s.invitations.id, id),
            eq(s.invitations.householdId, householdId),
            eq(s.invitations.kind, "household_member"),
          ),
        )
        .for("update");
      if (!invite) throw new HouseholdError(404, "NOT_FOUND");
      await familyRepresentative(tx, userId, householdId, "issuer");
      await tx.update(s.invitations).set({ revokedAt: new Date() }).where(eq(s.invitations.id, id));
      return { id };
    })
    .catch((error) => {
      if (error instanceof InvitationError) throw new HouseholdError(error.status, error.code);
      throw error;
    });
}

export async function renewFamilyInvitation(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  id: string,
) {
  return db
    .transaction(async (tx) => {
      const [i] = await tx
        .select()
        .from(s.invitations)
        .where(
          and(
            eq(s.invitations.id, id),
            eq(s.invitations.householdId, householdId),
            eq(s.invitations.kind, "household_member"),
          ),
        )
        .for("update");
      if (!i) throw new HouseholdError(404, "NOT_FOUND");
      await familyRepresentative(tx, userId, householdId, "issuer");
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.invitations)
        .where(
          and(
            eq(s.invitations.householdId, householdId),
            sql`${s.invitations.id} <> ${id}`,
            sql`${s.invitations.revokedAt} is null`,
            sql`${s.invitations.expiresAt}>now()`,
          ),
        );
      if (count.n >= 20) throw new HouseholdError(409, "FAMILY_INVITE_LIMIT");
      return rotateInvitation(tx, userId, i);
    })
    .catch((error) => {
      if (error instanceof InvitationError) throw new HouseholdError(error.status, error.code);
      throw error;
    });
}
