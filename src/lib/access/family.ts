import "server-only";
import { and, eq, sql } from "drizzle-orm";
import * as s from "../../../drizzle/schema";
import {
  familyRepresentative,
  editableChild,
  MAX_FAMILY_MEMBERS,
  type FamilyDatabase,
} from "./family-access";
import { familyMutation, type FamilyMutation, type FamilyPage } from "./family-contracts";
import { HouseholdError } from "./households";
import { managementPageSchema } from "./management-contracts";
export async function readFamily(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  page = 1,
): Promise<FamilyPage> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      const home = await familyRepresentative(tx, userId, householdId);
      const members = await tx
        .select({
          id: s.householdMembers.id,
          name: s.people.fullName,
          relation: s.householdMembers.relation,
          child: s.people.isChild,
          representative: s.householdMembers.isContactPerson,
          editable: editableChild,
        })
        .from(s.householdMembers)
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .where(eq(s.householdMembers.householdId, householdId))
        .orderBy(s.householdMembers.id)
        .limit(21)
        .offset((page - 1) * 20);
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.householdMembers)
        .where(eq(s.householdMembers.householdId, householdId));
      return {
        id: home.id,
        name: home.name,
        projectName: home.projectName,
        members: members.slice(0, 20),
        page,
        hasNext: members.length > 20 && page < 10000,
        canAdd: count.n < MAX_FAMILY_MEMBERS,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function mutateFamily(
  db: FamilyDatabase,
  userId: string,
  householdId: string,
  value: FamilyMutation,
) {
  const input = familyMutation.parse(value);
  return db.transaction(async (tx) => {
    await familyRepresentative(tx, userId, householdId, "write");
    if (input.action === "addChild") {
      const [existing] = await tx
        .select({
          id: s.householdMembers.id,
          name: s.people.fullName,
          relation: s.householdMembers.relation,
          editable: editableChild,
        })
        .from(s.householdMembers)
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .where(
          and(
            eq(s.householdMembers.householdId, householdId),
            eq(s.householdMembers.creationKey, input.requestId),
          ),
        );
      if (existing) {
        if (
          !existing.editable ||
          existing.name !== input.profile.name ||
          existing.relation !== input.profile.relation
        )
          throw new HouseholdError(409, "STALE_FAMILY");
        return { id: existing.id };
      }
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.householdMembers)
        .where(eq(s.householdMembers.householdId, householdId));
      if (count.n >= MAX_FAMILY_MEMBERS) throw new HouseholdError(409, "FAMILY_LIMIT");
      const [party] = await tx
        .insert(s.parties)
        .values({ kind: "person" })
        .returning({ id: s.parties.id });
      await tx
        .insert(s.people)
        .values({ partyId: party.id, fullName: input.profile.name, isChild: true });
      const [member] = await tx
        .insert(s.householdMembers)
        .values({
          householdId,
          personId: party.id,
          relation: input.profile.relation,
          isManagedChild: true,
          creationKey: input.requestId,
        })
        .returning({ id: s.householdMembers.id });
      return member;
    }
    const [member] = await tx
      .select({
        id: s.householdMembers.id,
        personId: s.people.partyId,
        name: s.people.fullName,
        relation: s.householdMembers.relation,
      })
      .from(s.householdMembers)
      .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
      .innerJoin(s.parties, eq(s.parties.id, s.people.partyId))
      .where(
        and(eq(s.householdMembers.householdId, householdId), eq(s.householdMembers.id, input.id)),
      )
      .for("update");
    if (!member) throw new HouseholdError(404, "NOT_FOUND");
    // Recheck after row locks: FK writers may have committed while this SELECT waited.
    const [eligibility] = await tx
      .select({ editable: editableChild })
      .from(s.householdMembers)
      .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
      .where(eq(s.householdMembers.id, member.id));
    if (!eligibility?.editable) throw new HouseholdError(404, "NOT_FOUND");
    if (member.name !== input.expected.name || member.relation !== input.expected.relation)
      throw new HouseholdError(409, "STALE_FAMILY");
    if (input.action === "removeChild") {
      await tx.delete(s.householdMembers).where(eq(s.householdMembers.id, member.id));
      await tx.delete(s.parties).where(eq(s.parties.id, member.personId));
    } else {
      await tx
        .update(s.people)
        .set({ fullName: input.profile.name })
        .where(eq(s.people.partyId, member.personId));
      await tx
        .update(s.householdMembers)
        .set({ relation: input.profile.relation })
        .where(eq(s.householdMembers.id, member.id));
    }
    return { id: member.id };
  });
}
