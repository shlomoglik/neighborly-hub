import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { MANAGEMENT_PAGE_SIZE, managementPageSchema } from "./management-contracts";
import { MAX_DIRECTORY_PAGE } from "./contracts";
import { staffInput, type StaffInput, type StaffPage } from "./staff-contracts";
type Database = PostgresJsDatabase<typeof s>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export class StaffError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
async function authorize(tx: Transaction, actorId: string, projectId: string, write = false) {
  const grantQuery = tx
    .select({ role: s.globalRoles.role })
    .from(s.globalRoles)
    .where(and(eq(s.globalRoles.userId, actorId), eq(s.globalRoles.role, "admin")));
  // Same locking protocol as project setup: revoking this grant cannot race the write.
  const grants = await (write ? grantQuery.for("share") : grantQuery);
  if (!grants.length) throw new StaffError(403, "FORBIDDEN");
  const [project] = await tx
    .select({ id: s.projects.id, name: s.projects.name })
    .from(s.projects)
    .where(eq(s.projects.id, projectId));
  if (!project) throw new StaffError(404, "NOT_FOUND");
  return project;
}
export async function readProjectStaff(
  db: Database,
  actorId: string,
  projectId: string,
  page = 1,
): Promise<StaffPage> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      const project = await authorize(tx, actorId, projectId);
      const buildings = await tx
        .select({ id: s.buildings.id, name: s.buildings.name })
        .from(s.buildings)
        .where(eq(s.buildings.projectId, projectId))
        .orderBy(s.buildings.name, s.buildings.id);
      const rows = await tx
        .select({
          id: s.staffAssignments.id,
          name: s.appUsers.displayName,
          email: s.appUsers.email,
          role: s.staffAssignments.role,
          buildingId: s.staffAssignments.buildingId,
        })
        .from(s.staffAssignments)
        .innerJoin(s.appUsers, eq(s.appUsers.id, s.staffAssignments.userId))
        .where(eq(s.staffAssignments.projectId, projectId))
        .orderBy(
          s.appUsers.email,
          s.staffAssignments.role,
          s.staffAssignments.buildingId,
          s.staffAssignments.id,
        )
        .limit(MANAGEMENT_PAGE_SIZE + 1)
        .offset((page - 1) * MANAGEMENT_PAGE_SIZE);
      return {
        project,
        buildings,
        assignments: rows.slice(0, MANAGEMENT_PAGE_SIZE).map((r) => ({
          ...r,
          role: r.role === "project_manager" ? "project_manager" : "building_manager",
        })),
        page,
        hasNext: rows.length > MANAGEMENT_PAGE_SIZE && page < MAX_DIRECTORY_PAGE,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function assignProjectStaff(
  db: Database,
  actorId: string,
  projectId: string,
  value: StaffInput,
) {
  const input = staffInput.parse(value);
  return db.transaction(async (tx) => {
    await authorize(tx, actorId, projectId, true);
    if (input.buildingId) {
      const [building] = await tx
        .select({ id: s.buildings.id })
        .from(s.buildings)
        .where(and(eq(s.buildings.id, input.buildingId), eq(s.buildings.projectId, projectId)));
      if (!building) throw new StaffError(404, "NOT_FOUND");
    }
    // Exact normalized email only; never list/search all accounts or infer resident identity.
    const users = await tx
      .select({ id: s.appUsers.id })
      .from(s.appUsers)
      .where(sql`lower(${s.appUsers.email}) = ${input.email}`)
      .limit(2);
    if (users.length !== 1) throw new StaffError(400, "USER_UNAVAILABLE");
    const [assignment] = await tx
      .insert(s.staffAssignments)
      .values({ userId: users[0].id, projectId, role: input.role, buildingId: input.buildingId })
      .onConflictDoNothing()
      .returning({ assignmentId: s.staffAssignments.id });
    if (!assignment) throw new StaffError(409, "ALREADY_ASSIGNED");
    return assignment;
  });
}
export async function revokeProjectStaff(
  db: Database,
  actorId: string,
  projectId: string,
  assignmentId: string,
) {
  return db.transaction(async (tx) => {
    await authorize(tx, actorId, projectId, true);
    const removed = await tx
      .delete(s.staffAssignments)
      .where(
        and(eq(s.staffAssignments.id, assignmentId), eq(s.staffAssignments.projectId, projectId)),
      )
      .returning({ id: s.staffAssignments.id });
    if (!removed.length) throw new StaffError(404, "NOT_FOUND");
    return { removed: true };
  });
}
