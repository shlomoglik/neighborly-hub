import "server-only";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { hasDirectoryAccess } from "./policy";
import { loadGrants, scopeFor } from "./grants";
import {
  DIRECTORY_PAGE_SIZE,
  MAX_DIRECTORY_PAGE,
  type DirectoryPage,
  type DirectoryQuery,
  type DirectoryResident,
} from "./contracts";

/** Self identity is supplied by the session boundary, never by request parameters. */
export async function readDirectory(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
  projectId: string,
  options: DirectoryQuery = { query: "", buildingId: "", page: 1 },
): Promise<DirectoryPage | null> {
  return db.transaction(
    async (tx) => {
      const [project] = await tx
        .select({ visibility: s.projects.directoryVisibility })
        .from(s.projects)
        .where(eq(s.projects.id, projectId));
      if (!project) return null;
      const grants = await loadGrants(tx, userId);
      const { scope, residentBuildings } = scopeFor(grants, projectId, project.visibility);
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
      const search = `%${options.query.replace(/[\\%_]/g, "\\$&")}%`;
      // Page resident identities before joining contacts, so one person is never split across pages.
      const candidates = await tx
        .select({ householdId: s.households.id, personId: s.people.partyId })
        .from(s.households)
        .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
        .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
        .innerJoin(s.householdMembers, eq(s.householdMembers.householdId, s.households.id))
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .where(
          and(
            eq(s.buildings.projectId, projectId),
            eq(s.households.isActive, true),
            eq(s.households.approvalStatus, "approved"),
            eq(s.people.isChild, false),
            scope.allBuildings ? sql`true` : within(scope.buildings),
            options.buildingId ? eq(s.buildings.id, options.buildingId) : sql`true`,
            options.query
              ? or(
                  ilike(s.people.fullName, search),
                  ilike(s.households.displayName, search),
                  ilike(s.apartments.number, search),
                )
              : sql`true`,
          ),
        )
        .orderBy(
          s.buildings.name,
          s.buildings.id,
          s.apartments.number,
          s.households.id,
          s.people.fullName,
          s.people.partyId,
        )
        .limit(DIRECTORY_PAGE_SIZE + 1)
        .offset((options.page - 1) * DIRECTORY_PAGE_SIZE);
      const page = candidates.slice(0, DIRECTORY_PAGE_SIZE);
      const hasNext = candidates.length > DIRECTORY_PAGE_SIZE && options.page < MAX_DIRECTORY_PAGE;
      if (!page.length) return { residents: [], page: options.page, hasNext: false };
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
          or(
            ...page.map((p) =>
              and(eq(s.households.id, p.householdId), eq(s.people.partyId, p.personId)),
            ),
          ),
        )
        .orderBy(
          s.buildings.name,
          s.buildings.id,
          s.apartments.number,
          s.households.id,
          s.people.fullName,
          s.people.partyId,
          s.contactMethods.id,
        );
      const residents = new Map<string, DirectoryResident>();
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
        if (row.contactId && (row.kind === "phone" || row.kind === "email") && row.value)
          resident.contacts.push({ kind: row.kind, value: row.value, label: row.label });
      }
      return { residents: [...residents.values()], page: options.page, hasNext };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
