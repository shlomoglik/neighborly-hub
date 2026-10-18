import "server-only";
import { and, eq, exists, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { MAX_DIRECTORY_PAGE } from "./contracts";
import { toBuildingHierarchy } from "../db/building-hierarchy-model";
import {
  MANAGEMENT_PAGE_SIZE,
  type ManagementHierarchy,
  type ManagementProjects,
} from "./management-contracts";
type Database = PostgresJsDatabase<typeof s>;
type Reader = Pick<Database, "select">;
const snapshot = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
// Management deliberately never consults resident identities or directory visibility.
function managementScope(tx: Reader, userId: string) {
  const admin = exists(
    tx
      .select({ id: s.globalRoles.userId })
      .from(s.globalRoles)
      .where(and(eq(s.globalRoles.userId, userId), eq(s.globalRoles.role, "admin"))),
  );
  const staff = (building: boolean) =>
    exists(
      tx
        .select({ id: s.staffAssignments.id })
        .from(s.staffAssignments)
        .where(
          and(
            eq(s.staffAssignments.userId, userId),
            eq(s.staffAssignments.projectId, s.projects.id),
            building
              ? or(
                  eq(s.staffAssignments.role, "project_manager"),
                  and(
                    eq(s.staffAssignments.role, "building_manager"),
                    eq(s.staffAssignments.buildingId, s.buildings.id),
                  ),
                )
              : sql`true`,
          ),
        ),
    );
  return { admin, project: or(admin, staff(false)), building: or(admin, staff(true)) };
}
export async function readManagementProjects(
  db: Database,
  userId: string,
  page = 1,
): Promise<ManagementProjects> {
  return db.transaction(async (tx) => {
    const scope = managementScope(tx, userId);
    const [capabilities] = await tx
      .select({
        canCreateProject: sql<boolean>`${scope.admin}`,
        hasManagementAccess: sql<boolean>`${scope.admin} or exists (select 1 from ${s.staffAssignments} where ${s.staffAssignments.userId} = ${userId})`,
      })
      .from(sql`(select 1) as capability`);
    const projects = await tx
      .select({ id: s.projects.id, name: s.projects.name, city: s.projects.city })
      .from(s.projects)
      .where(scope.project)
      .orderBy(s.projects.name, s.projects.id)
      .limit(MANAGEMENT_PAGE_SIZE + 1)
      .offset((page - 1) * MANAGEMENT_PAGE_SIZE);
    return {
      ...capabilities,
      projects: projects.slice(0, MANAGEMENT_PAGE_SIZE),
      page,
      hasNext: projects.length > MANAGEMENT_PAGE_SIZE && page < MAX_DIRECTORY_PAGE,
    };
  }, snapshot);
}
export async function readManagementHierarchy(
  db: Database,
  userId: string,
  projectId: string,
): Promise<ManagementHierarchy | null> {
  return db.transaction(async (tx) => {
    const scope = managementScope(tx, userId);
    const [project] = await tx
      .select({
        id: s.projects.id,
        name: s.projects.name,
        city: s.projects.city,
        canAddBuilding: sql<boolean>`${scope.admin} or exists (select 1 from ${s.staffAssignments} where ${s.staffAssignments.userId} = ${userId} and ${s.staffAssignments.projectId} = ${projectId} and ${s.staffAssignments.role} = 'project_manager')`,
      })
      .from(s.projects)
      .where(and(eq(s.projects.id, projectId), scope.project));
    if (!project) return null;
    const rows = await tx
      .select({
        buildingId: s.buildings.id,
        buildingName: s.buildings.name,
        floorId: s.floors.id,
        floorNumber: s.floors.number,
        apartmentId: s.apartments.id,
        apartmentNumber: s.apartments.number,
      })
      .from(s.buildings)
      .innerJoin(s.projects, eq(s.projects.id, s.buildings.projectId))
      .leftJoin(s.floors, eq(s.floors.buildingId, s.buildings.id))
      .leftJoin(
        s.apartments,
        and(eq(s.apartments.floorId, s.floors.id), eq(s.apartments.buildingId, s.buildings.id)),
      )
      .where(and(eq(s.projects.id, projectId), scope.building))
      .orderBy(
        s.buildings.name,
        s.buildings.id,
        s.floors.number,
        s.floors.id,
        s.apartments.number,
        s.apartments.id,
      );
    const buildings = toBuildingHierarchy(rows);
    // Fixed locale and ID tie-breaker make numeric and textual labels deterministic.
    const collator = new Intl.Collator("en", { numeric: true });
    for (const b of buildings)
      for (const f of b.floors)
        f.apartments.sort(
          (a, b) => collator.compare(a.number, b.number) || a.id.localeCompare(b.id),
        );
    return {
      ...project,
      buildings,
      counts: {
        buildings: buildings.length,
        floors: buildings.reduce((n, b) => n + b.floors.length, 0),
        apartments: buildings.reduce(
          (n, b) => n + b.floors.reduce((n, f) => n + f.apartments.length, 0),
          0,
        ),
      },
    };
  }, snapshot);
}
