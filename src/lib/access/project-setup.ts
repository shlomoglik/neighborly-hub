import "server-only";
import { and, eq } from "drizzle-orm";
import { globalRoles } from "../../../drizzle/schema";
import { insertProjectStructure, type StructureDatabase } from "../db/project-structure";
import {
  projectSetupInput,
  toProjectStructure,
  type ProjectSetupInput,
} from "../db/project-setup-input";

export async function canCreateProject(db: Pick<StructureDatabase, "select">, userId: string) {
  const roles = await db
    .select({ role: globalRoles.role })
    .from(globalRoles)
    .where(and(eq(globalRoles.userId, userId), eq(globalRoles.role, "admin")));
  return roles.length > 0;
}

/** Re-read and lock the verified actor's global grant inside the write transaction. */
export async function provisionProjectSetup(
  db: StructureDatabase,
  userId: string,
  input: ProjectSetupInput,
) {
  const parsed = projectSetupInput.parse(input);
  return db.transaction(async (tx) => {
    const roles = await tx
      .select({ role: globalRoles.role })
      .from(globalRoles)
      .where(and(eq(globalRoles.userId, userId), eq(globalRoles.role, "admin")))
      .for("share");
    if (!roles.length) return null;
    return insertProjectStructure(tx, toProjectStructure(parsed));
  });
}
