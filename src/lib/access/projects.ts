import "server-only";
import { eq, inArray, or, and, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import { loadGrants, scopeFor } from "./grants";
import { hasDirectoryAccess } from "./policy";
import type { DirectoryProject } from "./contracts";
export async function readDirectoryProjects(
  db: PostgresJsDatabase<typeof s>,
  userId: string,
): Promise<DirectoryProject[]> {
  return db.transaction(
    async (tx) => {
      const grants = await loadGrants(tx, userId);
      const ids = [
        ...new Set([
          ...grants.staff.map((a) => a.projectId),
          ...grants.homes.map((h) => h.projectId),
        ]),
      ];
      if (!grants.admin && !ids.length) return [];
      const projects = await tx
        .select({
          id: s.projects.id,
          name: s.projects.name,
          visibility: s.projects.directoryVisibility,
        })
        .from(s.projects)
        .where(grants.admin ? sql`true` : inArray(s.projects.id, ids))
        .orderBy(s.projects.name, s.projects.id);
      const allowed = projects
        .map((p) => ({ ...p, scope: scopeFor(grants, p.id, p.visibility).scope }))
        .filter((p) => hasDirectoryAccess(p.scope));
      if (!allowed.length) return [];
      const buildings = await tx
        .select({ id: s.buildings.id, name: s.buildings.name, projectId: s.buildings.projectId })
        .from(s.buildings)
        .where(
          or(
            ...allowed.map((p) =>
              and(
                eq(s.buildings.projectId, p.id),
                p.scope.allBuildings ? sql`true` : inArray(s.buildings.id, p.scope.buildings),
              ),
            ),
          ),
        )
        .orderBy(s.buildings.name, s.buildings.id);
      return allowed.map((p) => ({
        id: p.id,
        name: p.name,
        buildings: buildings
          .filter((b) => b.projectId === p.id)
          .map((b) => ({ id: b.id, name: b.name })),
      }));
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
