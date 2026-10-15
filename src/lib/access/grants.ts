import "server-only";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { directoryScope } from "./policy";
type Reader = Pick<PostgresJsDatabase<typeof s>, "select">;
export async function loadGrants(db: Reader, userId: string) {
  const admins = await db
    .select({ role: s.globalRoles.role })
    .from(s.globalRoles)
    .where(and(eq(s.globalRoles.userId, userId), eq(s.globalRoles.role, "admin")));
  const staff = await db
    .select({
      projectId: s.staffAssignments.projectId,
      role: s.staffAssignments.role,
      buildingId: s.staffAssignments.buildingId,
    })
    .from(s.staffAssignments)
    .where(eq(s.staffAssignments.userId, userId));
  const homes = await db
    .select({ projectId: s.buildings.projectId, buildingId: s.buildings.id })
    .from(s.userPersonLinks)
    .innerJoin(s.householdMembers, eq(s.householdMembers.personId, s.userPersonLinks.personId))
    .innerJoin(s.households, eq(s.households.id, s.householdMembers.householdId))
    .innerJoin(s.apartments, eq(s.apartments.id, s.households.apartmentId))
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .where(
      and(
        eq(s.userPersonLinks.userId, userId),
        eq(s.households.isActive, true),
        eq(s.households.approvalStatus, "approved"),
      ),
    );
  return { admin: admins.length > 0, staff, homes };
}
export function scopeFor(
  grants: Awaited<ReturnType<typeof loadGrants>>,
  projectId: string,
  visibility: string,
) {
  const staff = grants.staff.filter((a) => a.projectId === projectId);
  const residentBuildings = grants.homes
    .filter((h) => h.projectId === projectId)
    .map((h) => h.buildingId);
  const scope = directoryScope({
    admin: grants.admin,
    projectManager: staff.some((a) => a.role === "project_manager"),
    managedBuildings: staff
      .filter((a) => a.role === "building_manager" && a.buildingId)
      .map((a) => a.buildingId!),
    residentBuildings,
    directoryVisibility: visibility,
  });
  return { scope, residentBuildings };
}
