import "server-only";
import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
type Tx = Parameters<Parameters<PostgresJsDatabase<typeof s>["transaction"]>[0]>[0];
export type StaffRoleStatus = "assigned" | "upgrade" | "available";
export async function staffRoleStatus(
  tx: Tx,
  userId: string,
  projectId: string,
  role: string,
  buildingId: string | null,
): Promise<StaffRoleStatus> {
  const grants = await tx
    .select({ role: s.staffAssignments.role, buildingId: s.staffAssignments.buildingId })
    .from(s.staffAssignments)
    .where(and(eq(s.staffAssignments.userId, userId), eq(s.staffAssignments.projectId, projectId)));
  if (
    grants.some(
      (g) =>
        g.role === "project_manager" ||
        (role === "building_manager" && g.buildingId === buildingId),
    )
  )
    return "assigned";
  return role === "project_manager" && grants.length ? "upgrade" : "available";
}
// Callers lock the account row first, serializing invitations, direct grants and approvals.
export async function grantStaffRole(
  tx: Tx,
  userId: string,
  projectId: string,
  role: "project_manager" | "building_manager",
  buildingId: string | null,
) {
  const [grant] = await tx
    .insert(s.staffAssignments)
    .values({ userId, projectId, role, buildingId })
    .onConflictDoNothing()
    .returning({ assignmentId: s.staffAssignments.id });
  if (grant && role === "project_manager")
    await tx
      .delete(s.staffAssignments)
      .where(
        and(
          eq(s.staffAssignments.userId, userId),
          eq(s.staffAssignments.projectId, projectId),
          eq(s.staffAssignments.role, "building_manager"),
        ),
      );
  return grant;
}
