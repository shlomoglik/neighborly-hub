import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { HouseholdError } from "./households";
export type FamilyDatabase = PostgresJsDatabase<typeof s>;
export type FamilyTransaction = Parameters<Parameters<FamilyDatabase["transaction"]>[0]>[0];
/** Staff/admin grants never substitute for a verified adult household representative. */
export async function familyRepresentative(
  tx: FamilyTransaction,
  userId: string,
  householdId: string,
  lock: false | "write" | "issuer" = false,
) {
  const identityQuery = tx
    .select({ personId: s.people.partyId })
    .from(s.userPersonLinks)
    .innerJoin(s.people, eq(s.people.partyId, s.userPersonLinks.personId))
    .where(and(eq(s.userPersonLinks.userId, userId), eq(s.people.isChild, false)));
  const [identity] = await (lock
    ? identityQuery.for(lock === "write" ? "update" : "share")
    : identityQuery);
  if (!identity) throw new HouseholdError(404, "NOT_FOUND");
  const query = tx
    .select({
      id: s.households.id,
      name: s.households.displayName,
      projectId: s.buildings.projectId,
      buildingId: s.buildings.id,
      apartmentId: s.apartments.id,
      projectName: s.projects.name,
    })
    .from(s.householdMembers)
    .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
    .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
    .where(
      and(
        eq(s.householdMembers.personId, identity.personId),
        eq(s.householdMembers.householdId, householdId),
        eq(s.householdMembers.isContactPerson, true),
        eq(s.households.isActive, true),
        eq(s.households.approvalStatus, "approved"),
      ),
    );
  const [home] = await (lock === "write"
    ? query.for("update", { of: [s.householdMembers, s.households] })
    : lock === "issuer"
      ? query.for("share", { of: s.householdMembers })
      : query);
  if (!home) throw new HouseholdError(404, "NOT_FOUND");
  return home;
}
/** Newly created private child profiles may never become identity/ownership/contact management shortcuts. */
export const editableChild = sql<boolean>`(
  ${s.householdMembers.isManagedChild} and not ${s.householdMembers.isContactPerson} and ${s.people.isChild}
  and not exists(select 1 from user_person_links upl where upl.person_id = ${s.people.partyId})
  and not exists(select 1 from household_members hm where hm.person_id = ${s.people.partyId} and hm.id <> ${s.householdMembers.id})
  and not exists(select 1 from apartment_ownerships ao where ao.owner_party_id = ${s.people.partyId})
  and not exists(select 1 from contact_methods cm where cm.party_id = ${s.people.partyId})
  and not exists(select 1 from organization_contacts oc where oc.person_party_id = ${s.people.partyId})
)`;
export const MAX_FAMILY_MEMBERS = 50;
