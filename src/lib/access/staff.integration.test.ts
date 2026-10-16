import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { readManagementHierarchy, readManagementProjects } from "./management";
import { readProjectStaff } from "./staff";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET, POST } from "@/app/api/management/projects/[projectId]/staff/route";
import { DELETE } from "@/app/api/management/projects/[projectId]/staff/[assignmentId]/route";
const config = {
  baseURL: "https://staff.test",
  secret: "staff-integration-only-32-character-secret",
  googleClientId: "test",
  googleClientSecret: "test",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 2 });
  const db = drizzle(client, { schema: s });
  const auth = betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] });
  return { client, db, auth };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("PostgreSQL administrator staff assignment lifecycle", () => {
  const [admin, pm, bm, resident, target] = Array.from({ length: 5 }, () => crypto.randomUUID());
  const users = [admin, pm, bm, resident, target];
  const [project, otherProject, a, b, otherBuilding] = Array.from({ length: 5 }, () =>
    crypto.randomUUID(),
  );
  const email = `${target}@example.test`;
  const input = { email, role: "building_manager", buildingId: a };
  const context = (projectId = project) => ({ params: Promise.resolve({ projectId }) });
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({
          id,
          email: `${id}@example.test`,
          name: "Staff fixture",
          emailVerified: true,
        }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    await fixture.db.insert(s.projects).values([
      { id: project, name: "Staff project" },
      { id: otherProject, name: "Other staff project" },
    ]);
    await fixture.db.insert(s.buildings).values([
      { id: a, projectId: project, name: "A" },
      { id: b, projectId: project, name: "B" },
      { id: otherBuilding, projectId: otherProject, name: "Other" },
    ]);
    await fixture.db.insert(s.staffAssignments).values([
      { userId: pm, projectId: project, role: "project_manager" },
      { userId: bm, projectId: project, role: "building_manager", buildingId: a },
    ]);
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.db.delete(s.projects).where(inArray(s.projects.id, [project, otherProject]));
      await fixture.db.delete(s.appUsers).where(inArray(s.appUsers.id, users));
    } finally {
      await fixture.client.end();
    }
  });
  async function request(
    method: string,
    userId?: string,
    body: unknown = input,
    origin = config.baseURL,
  ) {
    const headers = new Headers(
      userId ? (await (await fixture.auth.$context).test.login({ userId })).headers : undefined,
    );
    headers.set("origin", origin);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    headers.set("x-role", "admin");
    return new Request(config.baseURL + "/api/management/projects/staff?userId=" + admin, {
      method,
      headers,
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    });
  }
  function check(r: Response, status: number) {
    expect(r.status).toBe(status);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Vary")).toBe("Cookie");
  }
  it("blocks anonymous requests and all non-admin roles, ignoring forged identity and role claims", async () => {
    const assignmentId = crypto.randomUUID();
    for (const user of [undefined, pm, bm, resident, target]) {
      const code = user ? 403 : 401;
      check(await GET(await request("GET", user), context()), code);
      check(await POST(await request("POST", user), context()), code);
      check(
        await DELETE(await request("DELETE", user), {
          params: Promise.resolve({ projectId: project, assignmentId }),
        }),
        code,
      );
    }
  });
  it("grants only the requested scope, combines assignments, and removes only the selected grant", async () => {
    expect((await readManagementProjects(fixture.db, target)).projects).toEqual([]);
    const added = await POST(
      await request("POST", admin, { ...input, email: ` ${email.toUpperCase()} ` }),
      context(),
    );
    check(added, 201);
    const { assignmentId } = await added.json();
    expect(
      (await readManagementHierarchy(fixture.db, target, project))!.buildings.map((b) => b.id),
    ).toEqual([a]);
    expect(await readManagementHierarchy(fixture.db, target, otherProject)).toBeNull();
    check(await POST(await request("POST", admin), context()), 409);
    const second = await POST(await request("POST", admin, { ...input, buildingId: b }), context());
    check(second, 201);
    const secondId = (await second.json()).assignmentId;
    expect(
      (await readManagementHierarchy(fixture.db, target, project))!.buildings.map((b) => b.id),
    ).toEqual([a, b]);
    check(
      await DELETE(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: otherProject, assignmentId }),
      }),
      404,
    );
    check(
      await DELETE(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: project, assignmentId }),
      }),
      200,
    );
    expect(
      (await readManagementHierarchy(fixture.db, target, project))!.buildings.map((b) => b.id),
    ).toEqual([b]);
    check(
      await DELETE(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: project, assignmentId: secondId }),
      }),
      200,
    );
    expect(await readManagementHierarchy(fixture.db, target, project)).toBeNull();
    const manager = await POST(
      await request("POST", admin, { email, role: "project_manager", buildingId: null }),
      context(),
    );
    check(manager, 201);
    expect((await readManagementHierarchy(fixture.db, target, project))!.buildings).toHaveLength(2);
    expect((await readManagementProjects(fixture.db, target)).canCreateProject).toBe(false);
    expect(
      await fixture.db.select().from(s.userPersonLinks).where(eq(s.userPersonLinks.userId, target)),
    ).toEqual([]);
    const page = await GET(await request("GET", admin), context());
    check(page, 200);
    const body = await page.json();
    expect(body.assignments).toEqual(
      expect.arrayContaining([expect.objectContaining({ email, role: "project_manager" })]),
    );
    expect(Object.keys(body.assignments[0]).sort()).toEqual([
      "buildingId",
      "email",
      "id",
      "name",
      "role",
    ]);
  });
  it("rejects cross-project buildings, nonexistent users, unsafe role shapes, and invalid identifiers", async () => {
    check(
      await POST(await request("POST", admin, { ...input, buildingId: otherBuilding }), context()),
      404,
    );
    check(
      await POST(
        await request("POST", admin, { ...input, email: "missing@example.test" }),
        context(),
      ),
      400,
    );
    for (const bad of [
      { ...input, role: "admin" },
      { ...input, role: "project_manager" },
      { ...input, buildingId: null },
      { ...input, userId: admin },
    ])
      check(await POST(await request("POST", admin, bad), context()), 400);
    check(await GET(await request("GET", admin), context("invalid")), 404);
    check(await GET(await request("GET", admin), context(crypto.randomUUID())), 404);
    check(
      await DELETE(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: project, assignmentId: "bad" }),
      }),
      404,
    );
  });
  it("blocks missing/foreign origins for both write methods", async () => {
    for (const origin of ["", "https://evil.test"]) {
      check(await POST(await request("POST", admin, input, origin), context()), 403);
      check(
        await DELETE(await request("DELETE", admin, input, origin), {
          params: Promise.resolve({ projectId: project, assignmentId: crypto.randomUUID() }),
        }),
        403,
      );
    }
  });
  it("enforces unique assignment under concurrent submissions and paginates deterministically", async () => {
    const body = { email: `${resident}@example.test`, role: "building_manager", buildingId: a };
    const responses = await Promise.all([
      POST(await request("POST", admin, body), context()),
      POST(await request("POST", admin, body), context()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const buildings = Array.from({ length: 22 }, (_, i) => ({
      id: crypto.randomUUID(),
      projectId: project,
      name: `Page ${String(i).padStart(2, "0")}`,
    }));
    await fixture.db.insert(s.buildings).values(buildings);
    await fixture.db.insert(s.staffAssignments).values(
      buildings.map((b) => ({
        userId: target,
        projectId: project,
        role: "building_manager",
        buildingId: b.id,
      })),
    );
    const first = await readProjectStaff(fixture.db, admin, project);
    const next = await readProjectStaff(fixture.db, admin, project, 2);
    expect(first.assignments).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(next.hasNext).toBe(false);
    expect(new Set([...first.assignments, ...next.assignments].map((a) => a.id)).size).toBe(
      first.assignments.length + next.assignments.length,
    );
    expect(await readProjectStaff(fixture.db, admin, project)).toEqual(first);
  });
  it("rechecks expired sessions and revoked administrator privileges before reads or mutations", async () => {
    const signed = await (await fixture.auth.$context).test.login({ userId: admin });
    await fixture.db
      .update(s.authSessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(s.authSessions.token, signed.token));
    check(await GET(new Request(config.baseURL, { headers: signed.headers }), context()), 401);
    await fixture.db.delete(s.globalRoles).where(eq(s.globalRoles.userId, admin));
    check(await GET(await request("GET", admin), context()), 403);
    check(await POST(await request("POST", admin), context()), 403);
    check(
      await DELETE(await request("DELETE", admin), {
        params: Promise.resolve({ projectId: project, assignmentId: crypto.randomUUID() }),
      }),
      403,
    );
  });
});
