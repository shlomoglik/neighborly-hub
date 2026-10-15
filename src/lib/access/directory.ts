import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { directoryScope, hasDirectoryAccess } from "./policy";

/** Self identity is supplied by the session boundary, never by request parameters. */
export async function readDirectory(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
  projectId: string,
) {
  return db.transaction(
    async (tx) => {
      const [project] = await tx
        .select({ visibility: s.projects.directoryVisibility })
        .from(s.projects)
        .where(eq(s.projects.id, projectId));
      if (!project) return null;
      const admins = await tx
        .select({ role: s.globalRoles.role })
        .from(s.globalRoles)
        .where(and(eq(s.globalRoles.userId, userId), eq(s.globalRoles.role, "admin")));
      const staff = await tx
        .select({ role: s.staffAssignments.role, buildingId: s.staffAssignments.buildingId })
        .from(s.staffAssignments)
        .where(
          and(eq(s.staffAssignments.userId, userId), eq(s.staffAssignments.projectId, projectId)),
        );
      const homes = await tx
        .select({ buildingId: s.buildings.id })
        .from(s.userPersonLinks)
        .innerJoin(s.householdMembers, eq(s.householdMembers.personId, s.userPersonLinks.personId))
        .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
        .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
        .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
        .where(
          and(
            eq(s.userPersonLinks.userId, userId),
            eq(s.buildings.projectId, projectId),
            eq(s.households.isActive, true),
            eq(s.households.approvalStatus, "approved"),
          ),
        );
      const residentBuildings = homes.map((h) => h.buildingId);
      const scope = directoryScope({
        admin: admins.length > 0,
        projectManager: staff.some((a) => a.role === "project_manager"),
        managedBuildings: staff
          .filter((a) => a.role === "building_manager" && a.buildingId)
          .map((a) => a.buildingId!),
        residentBuildings,
        directoryVisibility: project.visibility,
      });
      if (!hasDirectoryAccess(scope)) return null;
      const within = (ids: string[]) => (ids.length ? inArray(s.buildings.id, ids) : sql`false`);
      const managerContact = scope.manager ? sql`true` : within(scope.managedBuildings);
      // Filter values in SQL, before any resident data reaches the route or client.
      const contacts = or(
        managerContact,
        and(
          eq(s.contactMethods.visibility, "project"),
          residentBuildings.length ? sql`true` : sql`false`,
        ),
        and(eq(s.contactMethods.visibility, "building"), within(residentBuildings)),
      );
      const rows = await tx
        .select({
          householdId: s.households.id,
          householdName: s.households.displayName,
          buildingId: s.buildings.id,
          buildingName: s.buildings.name,
          apartment: s.apartments.number,
          personId: s.people.partyId,
          name: s.people.fullName,
          contactId: s.contactMethods.id,
          kind: s.contactMethods.kind,
          value: s.contactMethods.value,
          label: s.contactMethods.label,
        })
        .from(s.households)
        .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
        .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
        .innerJoin(s.householdMembers, eq(s.householdMembers.householdId, s.households.id))
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .leftJoin(s.contactMethods, and(eq(s.contactMethods.partyId, s.people.partyId), contacts))
        .where(
          and(
            eq(s.buildings.projectId, projectId),
            eq(s.households.isActive, true),
            eq(s.households.approvalStatus, "approved"),
            eq(s.people.isChild, false),
            scope.allBuildings ? sql`true` : within(scope.buildings),
          ),
        )
        .orderBy(
          s.buildings.name,
          s.apartments.number,
          s.households.id,
          s.people.fullName,
          s.people.partyId,
          s.contactMethods.id,
        );
      type Resident = {
        personId: string;
        name: string;
        householdId: string;
        householdName: string;
        buildingId: string;
        buildingName: string;
        apartment: string;
        contacts: { kind: string; value: string; label: string | null }[];
      };
      const residents = new Map<string, Resident>();
      for (const row of rows) {
        const key = `${row.householdId}:${row.personId}`;
        let resident = residents.get(key);
        if (!resident) {
          resident = {
            personId: row.personId,
            name: row.name,
            householdId: row.householdId,
            householdName: row.householdName,
            buildingId: row.buildingId,
            buildingName: row.buildingName,
            apartment: row.apartment,
            contacts: [],
          };
          residents.set(key, resident);
        }
        if (row.contactId && row.kind && row.value)
          resident.contacts.push({ kind: row.kind, value: row.value, label: row.label });
      }
      return { residents: [...residents.values()] };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
