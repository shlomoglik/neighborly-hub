import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray, like } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { createProjectStructure } from "../db/project-structure";
import { canCreateProject } from "./project-setup";
import { readManagementHierarchy } from "./management";
import { readDirectoryProjects } from "./projects";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { POST } from "@/app/api/projects/setup/route";
const url = process.env.AUTH_TEST_DATABASE_URL;
const config = {
  baseURL: "https://setup.test",
  secret: "setup-integration-only-32-character-secret",
  googleClientId: "test-google",
  googleClientSecret: "test-google-secret",
};
function setup() {
  const client = postgres(url!, { max: 1 });
  const db = drizzle(client, { schema: s });
  const auth = betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] });
  return { client, db, auth };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("PostgreSQL authenticated project setup", () => {
  const prefix = `Setup-${crypto.randomUUID()}`;
  const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
  const [admin, resident, manager, buildingManager] = ids;
  const scopeProject = crypto.randomUUID();
  const scopeBuilding = crypto.randomUUID();
  const payload = (suffix: string) => ({
    name: `${prefix}-${suffix}`,
    city: "Sderot",
    buildings: [
      { name: "A", floors: 2, unitsPerFloor: 3 },
      { name: "B", floors: 1, unitsPerFloor: 2 },
    ],
  });
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of ids)
      await test.saveUser(
        test.createUser({
          id,
          email: `${id}@example.test`,
          name: "Setup fixture",
          emailVerified: true,
        }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    await fixture.db.insert(s.projects).values({ id: scopeProject, name: `${prefix}-scope` });
    await fixture.db
      .insert(s.buildings)
      .values({ id: scopeBuilding, projectId: scopeProject, name: "A" });
    await fixture.db.insert(s.staffAssignments).values([
      { userId: manager, projectId: scopeProject, role: "project_manager" },
      {
        userId: buildingManager,
        projectId: scopeProject,
        buildingId: scopeBuilding,
        role: "building_manager",
      },
    ]);
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(s.projects).where(like(s.projects.name, `${prefix}%`));
      await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, ids));
    } finally {
      await fixture.client.end();
    }
  });
  async function login(userId: string) {
    return (await fixture.auth.$context).test.login({ userId });
  }
  async function call(suffix: string, userId?: string, origin: string = config.baseURL) {
    const headers = new Headers(userId ? (await login(userId)).headers : undefined);
    headers.set("origin", origin);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    return POST(
      new Request(`${config.baseURL}/api/projects/setup`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload(suffix)),
      }),
    );
  }
  async function projectsNamed(suffix: string) {
    return fixture.db
      .select()
      .from(s.projects)
      .where(eq(s.projects.name, `${prefix}-${suffix}`));
  }
  it("requires a signed current session and a global admin role, not forged headers or scoped staff", async () => {
    expect((await call("anonymous")).status).toBe(401);
    expect(await projectsNamed("anonymous")).toEqual([]);
    for (const user of [resident, manager, buildingManager]) {
      expect(await canCreateProject(fixture.db, user)).toBe(false);
      expect((await call(user, user)).status).toBe(403);
      expect(await projectsNamed(user)).toEqual([]);
    }
  });
  it("persists the exact wizard hierarchy and makes the new project discoverable", async () => {
    const response = await call("created", admin);
    expect(response.status).toBe(201);
    const { projectId } = await response.json();
    expect(await readManagementHierarchy(fixture.db, admin, projectId)).toMatchObject({
      id: projectId,
      counts: { buildings: 2, floors: 3, apartments: 8 },
    });
    expect(await projectsNamed("created")).toMatchObject([{ id: projectId, city: "Sderot" }]);
    const rows = await fixture.db
      .select({ building: s.buildings.name, floor: s.floors.number, unit: s.apartments.number })
      .from(s.buildings)
      .innerJoin(s.floors, eq(s.floors.buildingId, s.buildings.id))
      .innerJoin(
        s.apartments,
        and(eq(s.apartments.floorId, s.floors.id), eq(s.apartments.buildingId, s.buildings.id)),
      )
      .where(eq(s.buildings.projectId, projectId))
      .orderBy(s.buildings.name, s.floors.number, s.apartments.number);
    expect(rows).toEqual([
      { building: "A", floor: 0, unit: "1" },
      { building: "A", floor: 0, unit: "2" },
      { building: "A", floor: 0, unit: "3" },
      { building: "A", floor: 1, unit: "4" },
      { building: "A", floor: 1, unit: "5" },
      { building: "A", floor: 1, unit: "6" },
      { building: "B", floor: 0, unit: "1" },
      { building: "B", floor: 0, unit: "2" },
    ]);
    expect(await readDirectoryProjects(fixture.db, admin)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId,
          buildings: expect.arrayContaining([
            expect.objectContaining({ name: "A" }),
            expect.objectContaining({ name: "B" }),
          ]),
        }),
      ]),
    );
    expect(await readDirectoryProjects(fixture.db, resident)).toEqual([]);
  });
  it("enforces origin checks for real signed sessions", async () => {
    for (const origin of ["", "https://attacker.test"])
      expect((await call("origin", admin, origin)).status).toBe(403);
    expect(await projectsNamed("origin")).toEqual([]);
  });
  it("rechecks revoked grants and revoked sessions before any new write", async () => {
    await fixture.db.delete(s.globalRoles).where(eq(s.globalRoles.userId, admin));
    expect((await call("revoked", admin)).status).toBe(403);
    expect(await projectsNamed("revoked")).toEqual([]);
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    const signed = await login(admin);
    await fixture.db.delete(s.authSessions).where(eq(s.authSessions.token, signed.token));
    const headers = new Headers(signed.headers);
    headers.set("origin", config.baseURL);
    headers.set("content-type", "application/json");
    expect(
      (
        await POST(
          new Request(`${config.baseURL}/api/projects/setup`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload("session")),
          }),
        )
      ).status,
    ).toBe(401);
    expect(await projectsNamed("session")).toEqual([]);
  });
  it("rolls back the shared hierarchy writer when a later building violates PostgreSQL constraints", async () => {
    await expect(
      createProjectStructure(
        {
          name: `${prefix}-rollback`,
          city: "Sderot",
          buildings: [
            { name: "A", floors: [{ number: 0, apartments: [{ number: "1" }] }] },
            { name: "B", floors: [{ number: 0, apartments: [{ number: "1" }, { number: "1" }] }] },
          ],
        },
        fixture.db,
      ),
    ).rejects.toThrow();
    expect(await projectsNamed("rollback")).toEqual([]);
  });
});
