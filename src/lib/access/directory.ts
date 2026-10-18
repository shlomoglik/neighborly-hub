import "server-only";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import type { GlobalSearchPage, GlobalSearchResident } from "./search-contracts";
import { hasDirectoryAccess } from "./policy";
import { loadGrants, scopeFor } from "./grants";
import {
  DIRECTORY_PAGE_SIZE,
  MAX_DIRECTORY_PAGE,
  type DirectoryPage,
  type DirectoryQuery,
} from "./contracts";

/** Self identity is supplied by the session boundary, never by request parameters. */
async function readScopedDirectory(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
  projectId: string | null,
  options: DirectoryQuery = { query: "", buildingId: "", page: 1 },
): Promise<GlobalSearchPage | null> {
  return db.transaction(
    async (tx) => {
      const grants = await loadGrants(tx, userId);
      const ids = [
        ...new Set([
          ...grants.staff.map((a) => a.projectId),
          ...grants.homes.map((h) => h.projectId),
        ]),
      ];
      if (projectId === null && !grants.admin && !ids.length)
        return { residents: [], page: options.page, hasNext: false };
      const projects = await tx
        .select({ id: s.projects.id, visibility: s.projects.directoryVisibility })
        .from(s.projects)
        .where(
          projectId
            ? eq(s.projects.id, projectId)
            : grants.admin
              ? sql`true`
              : inArray(s.projects.id, ids),
        );
      const allowed = projects
        .map((project) => ({
          ...project,
          ...scopeFor(grants, project.id, project.visibility),
        }))
        .filter(({ scope }) => hasDirectoryAccess(scope));
      if (!allowed.length)
        return projectId ? null : { residents: [], page: options.page, hasNext: false };
      const within = (ids: string[]) => (ids.length ? inArray(s.buildings.id, ids) : sql`false`);
      const buildingScope = or(
        ...allowed.map(({ id, scope }) =>
          and(
            eq(s.buildings.projectId, id),
            scope.allBuildings ? sql`true` : within(scope.buildings),
          ),
        ),
      );
      // Apply the same contact privacy predicate to matching and returned values.
      const contacts = or(
        ...allowed.map(({ id, scope, residentBuildings }) =>
          and(
            eq(s.buildings.projectId, id),
            or(
              scope.manager ? sql`true` : within(scope.managedBuildings),
              and(
                eq(s.contactMethods.visibility, "project"),
                residentBuildings.length ? sql`true` : sql`false`,
              ),
              and(eq(s.contactMethods.visibility, "building"), within(residentBuildings)),
            ),
          ),
        ),
      );
      const search = `%${options.query.replace(/[\\%_]/g, "\\$&")}%`;
      // Page resident identities before joining contacts, so one person is never split across pages.
      const candidates = await tx
        .select({ householdId: s.households.id, personId: s.people.partyId })
        .from(s.households)
        .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
        .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
        .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
        .innerJoin(s.householdMembers, eq(s.householdMembers.householdId, s.households.id))
        .innerJoin(s.people, eq(s.people.partyId, s.householdMembers.personId))
        .where(
          and(
            buildingScope,
            eq(s.households.isActive, true),
            eq(s.households.approvalStatus, "approved"),
            eq(s.people.isChild, false),
            options.buildingId ? eq(s.buildings.id, options.buildingId) : sql`true`,
            options.query
              ? or(
                  ilike(s.people.fullName, search),
                  ilike(s.households.displayName, search),
                  ilike(s.apartments.number, search),
                  projectId === null
                    ? sql`exists (
                    select 1 from ${s.contactMethods}
                    where ${s.contactMethods.partyId} = ${s.people.partyId}
                      and ${contacts}
                      and (
                        (${s.contactMethods.kind} in ('phone', 'email') and ${ilike(s.contactMethods.value, search)})
                        or (${s.contactMethods.kind} = 'phone'
                          and ${/^[+\d\s().-]+$/.test(options.query) && options.query.replace(/\D/g, "").length >= 2}
                          and regexp_replace(${s.contactMethods.value}, '[^0-9]', '', 'g') like ${`%${options.query.replace(/\D/g, "")}%`})
                      )
                  )`
                    : sql`false`,
                )
              : sql`true`,
          ),
        )
        .orderBy(
          s.projects.name,
          s.projects.id,
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
          projectId: s.projects.id,
          projectName: s.projects.name,
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
        .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
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
          s.projects.name,
          s.projects.id,
          s.buildings.name,
          s.buildings.id,
          s.apartments.number,
          s.households.id,
          s.people.fullName,
          s.people.partyId,
          s.contactMethods.id,
        );
      const residents = new Map<string, GlobalSearchResident>();
      for (const row of rows) {
        const key = `${row.householdId}:${row.personId}`;
        let resident = residents.get(key);
        if (!resident) {
          resident = {
            projectId: row.projectId,
            projectName: row.projectName,
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

export async function readDirectory(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
  projectId: string,
  options: DirectoryQuery = { query: "", buildingId: "", page: 1 },
): Promise<DirectoryPage | null> {
  const result = await readScopedDirectory(db, userId, projectId, options);
  if (!result) return null;
  return {
    ...result,
    residents: result.residents.map((resident) => {
      const { projectId: _id, projectName: _name, ...data } = resident;
      return data;
    }),
  };
}
export async function readGlobalSearch(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
  options: { query: string; page: number },
): Promise<GlobalSearchPage> {
  return (await readScopedDirectory(db, userId, null, { ...options, buildingId: "" }))!;
}
