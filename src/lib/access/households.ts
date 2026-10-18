import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { loadGrants, scopeFor } from "./grants";
import {
  householdMutation,
  type HouseholdDetail,
  type HouseholdList,
  type HouseholdMutation,
} from "./household-contracts";
type Database = PostgresJsDatabase<typeof s>;
export class HouseholdError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const unavailable = () => new HouseholdError(404, "NOT_FOUND");
const active = and(eq(s.households.isActive, true), eq(s.households.approvalStatus, "approved"));
const summary = {
  id: s.households.id,
  name: s.households.displayName,
  project: s.projects.name,
  building: s.buildings.name,
  apartment: s.apartments.number,
};

export async function listMyHouseholds(
  db: Database,
  userId: string,
  page: number,
): Promise<HouseholdList> {
  const rows = await db
    .select(summary)
    .from(s.userPersonLinks)
    .innerJoin(s.people, eq(s.people.partyId, s.userPersonLinks.personId))
    .innerJoin(s.householdMembers, eq(s.householdMembers.personId, s.people.partyId))
    .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
    .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
    .where(and(eq(s.userPersonLinks.userId, userId), eq(s.people.isChild, false), active))
    .orderBy(s.projects.name, s.projects.id, s.buildings.name, s.apartments.number, s.households.id)
    .limit(21)
    .offset((page - 1) * 20);
  return { households: rows.slice(0, 20), page, hasNext: rows.length > 20 && page < 10000 };
}

export async function readHousehold(
  db: Database,
  userId: string,
  id: string,
  page: number,
): Promise<HouseholdDetail | null> {
  return db.transaction(
    async (tx) => {
      const [home] = await tx
        .select({
          ...summary,
          floor: s.floors.number,
          projectId: s.projects.id,
          buildingId: s.buildings.id,
          visibility: s.projects.directoryVisibility,
        })
        .from(s.households)
        .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
        .innerJoin(s.floors, eq(s.floors.id, s.apartments.floorId))
        .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
        .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
        .where(and(eq(s.households.id, id), active));
      if (!home) return null;
      const { scope, residentBuildings } = scopeFor(
        await loadGrants(tx, userId),
        home.projectId,
        home.visibility,
      );
      const [self] = await tx
        .select({ personId: s.people.partyId, primary: s.householdMembers.isContactPerson })
        .from(s.userPersonLinks)
        .innerJoin(s.people, eq(s.people.partyId, s.userPersonLinks.personId))
        .innerJoin(s.householdMembers, eq(s.householdMembers.personId, s.people.partyId))
        .where(
          and(
            eq(s.userPersonLinks.userId, userId),
            eq(s.people.isChild, false),
            eq(s.householdMembers.householdId, id),
          ),
        );
      if (!self && !scope.allBuildings && !scope.buildings.includes(home.buildingId)) return null;
      const managed = scope.manager || scope.managedBuildings.includes(home.buildingId);
      const members = await tx
        .select({
          id: s.people.partyId,
          name: s.people.fullName,
          primary: s.householdMembers.isContactPerson,
        })
        .from(s.householdMembers)
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .where(and(eq(s.householdMembers.householdId, id), eq(s.people.isChild, false)))
        .orderBy(s.people.fullName, s.people.partyId)
        .limit(21)
        .offset((page - 1) * 20);
      const shown = members.slice(0, 20);
      // Only authorized contact values leave SQL. Being a family member does not expose another adult's private contacts.
      const contacts = shown.length
        ? await tx
            .select({
              personId: s.contactMethods.partyId,
              kind: s.contactMethods.kind,
              value: s.contactMethods.value,
            })
            .from(s.contactMethods)
            .where(
              and(
                inArray(
                  s.contactMethods.partyId,
                  shown.map((m) => m.id),
                ),
                or(
                  managed ? sql`true` : sql`false`,
                  self ? eq(s.contactMethods.partyId, self.personId) : sql`false`,
                  residentBuildings.length
                    ? eq(s.contactMethods.visibility, "project")
                    : sql`false`,
                  residentBuildings.includes(home.buildingId)
                    ? eq(s.contactMethods.visibility, "building")
                    : sql`false`,
                ),
              ),
            )
            .orderBy(s.contactMethods.id)
        : [];
      const ownContacts = self
        ? await tx
            .select({
              id: s.contactMethods.id,
              kind: s.contactMethods.kind,
              value: s.contactMethods.value,
              label: s.contactMethods.label,
              visibility: s.contactMethods.visibility,
            })
            .from(s.contactMethods)
            .where(eq(s.contactMethods.partyId, self.personId))
            .orderBy(s.contactMethods.id)
        : null;
      return {
        id: home.id,
        name: home.name,
        project: home.project,
        building: home.building,
        apartment: home.apartment,
        floor: home.floor,
        canRename: !!self?.primary,
        ownContacts:
          ownContacts?.map((c) => ({
            ...c,
            kind: c.kind as "phone" | "email",
            visibility: c.visibility as "managers" | "building" | "project",
          })) ?? null,
        members: shown.map((m) => ({
          ...m,
          contacts: contacts
            .filter((c) => c.personId === m.id)
            .map((c) => ({ kind: c.kind as "phone" | "email", value: c.value })),
        })),
        page,
        hasNext: members.length > 20 && page < 10000,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function updateHousehold(
  db: Database,
  userId: string,
  id: string,
  value: HouseholdMutation,
) {
  const input = householdMutation.parse(value);
  return db.transaction(async (tx) => {
    // Lock verified identity, person, membership and household before checking edit rights. Deletes/revocations serialize with writes.
    const [identity] = await tx
      .select({ personId: s.people.partyId })
      .from(s.userPersonLinks)
      .innerJoin(s.people, eq(s.people.partyId, s.userPersonLinks.personId))
      .where(and(eq(s.userPersonLinks.userId, userId), eq(s.people.isChild, false)))
      .for("update");
    if (!identity) throw unavailable();
    const [self] = await tx
      .select({
        personId: s.householdMembers.personId,
        primary: s.householdMembers.isContactPerson,
        name: s.households.displayName,
      })
      .from(s.householdMembers)
      .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
      .where(
        and(eq(s.householdMembers.personId, identity.personId), eq(s.households.id, id), active),
      )
      .for("update");
    if (!self) throw unavailable();
    if (input.action === "rename") {
      if (!self.primary) throw unavailable();
      if (self.name !== input.expected) throw new HouseholdError(409, "STALE_HOUSEHOLD");
      await tx.update(s.households).set({ displayName: input.name }).where(eq(s.households.id, id));
    } else if (input.action === "addContact") {
      const contacts = await tx
        .select({
          id: s.contactMethods.id,
          kind: s.contactMethods.kind,
          value: s.contactMethods.value,
        })
        .from(s.contactMethods)
        .where(eq(s.contactMethods.partyId, self.personId));
      if (contacts.some((c) => c.kind === input.contact.kind && c.value === input.contact.value))
        throw new HouseholdError(409, "DUPLICATE_CONTACT");
      if (contacts.length >= 10) throw new HouseholdError(409, "CONTACT_LIMIT");
      await tx.insert(s.contactMethods).values({ ...input.contact, partyId: self.personId });
    } else {
      const [current] = await tx
        .select()
        .from(s.contactMethods)
        .where(and(eq(s.contactMethods.id, input.id), eq(s.contactMethods.partyId, self.personId)))
        .for("update");
      if (!current) throw unavailable();
      if (
        current.kind !== input.expected.kind ||
        current.value !== input.expected.value ||
        current.label !== input.expected.label ||
        current.visibility !== input.expected.visibility
      )
        throw new HouseholdError(409, "STALE_HOUSEHOLD");
      if (input.action === "deleteContact")
        await tx.delete(s.contactMethods).where(eq(s.contactMethods.id, current.id));
      else
        await tx
          .update(s.contactMethods)
          .set(input.contact)
          .where(eq(s.contactMethods.id, current.id));
    }
    return { id };
  });
}
