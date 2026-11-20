import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET as list } from "@/app/api/projects/[projectId]/surveys/route";
import { GET as detail } from "@/app/api/projects/[projectId]/surveys/[surveyId]/route";
import { PUT } from "@/app/api/projects/[projectId]/surveys/[surveyId]/response/route";
const config = {
  baseURL: "https://surveys.test",
  secret: "survey-integration-only-32-character-secret",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, {
    max: 10,
    onnotice: () => {},
    connection: { application_name: "survey-resident-tests" },
  });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
const uuid = () => crypto.randomUUID();
describe.skipIf(!url)("Resident surveys with PostgreSQL and signed sessions", () => {
  const users = Array.from({ length: 12 }, uuid);
  const [
    admin,
    adult,
    roommate,
    child,
    managed,
    pending,
    rejected,
    inactive,
    unlinked,
    pm,
    bm,
    outsider,
  ] = users;
  const projects = [uuid(), uuid()],
    buildings = [uuid(), uuid(), uuid()];
  const persons = users.map(uuid),
    homes = users.map(uuid),
    apartments = users.map(uuid);
  const cookies = new Map<string, Headers>();
  let published: Awaited<ReturnType<typeof survey>>,
    draft: typeof published,
    foreign: typeof published;
  const context = (id?: string, projectId = projects[0]) => ({
    params: Promise.resolve({ projectId, ...(id ? { surveyId: id } : {}) }),
  });
  async function request(
    method = "GET",
    user: string | undefined = adult,
    body?: unknown,
    query = "",
  ) {
    const headers = new Headers(user ? cookies.get(user) : undefined);
    headers.set("origin", config.baseURL);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", admin);
    return new Request(`${config.baseURL}/api/surveys${query}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function read(user = adult, id = published.id, projectId = projects[0]) {
    return detail(await request("GET", user), context(id, projectId));
  }
  async function vote(
    user = adult,
    f = published,
    optionId = f.options[0],
    projectId = projects[0],
  ) {
    return PUT(await request("PUT", user, { optionId }), context(f.id, projectId));
  }
  async function survey(projectId = projects[0], publish = true) {
    const id = uuid(),
      options = [uuid(), uuid()];
    await fixture.client.begin(async (tx) => {
      await tx`insert into community_surveys(id, project_id, question, created_by) values (${id}, ${projectId}, 'Synthetic question', ${unlinked})`;
      for (let i = 0; i < 2; i++)
        await tx`insert into community_survey_options(id, survey_id, label, position) values (${options[i]}, ${id}, ${`Choice ${i}`}, ${i + 1})`;
      if (publish)
        await tx`update community_surveys set state = 'published', published_at = clock_timestamp() where id = ${id}`;
    });
    return { id, options };
  }
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users) {
      await test.saveUser(
        test.createUser({ id, email: `${id}@example.test`, name: "Synthetic resident" }),
      );
      cookies.set(id, new Headers((await test.login({ userId: id })).headers));
    }
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.globalRoles).values({ userId: admin, role: "admin" });
      await tx
        .insert(s.projects)
        .values(
          projects.map((id) => ({ id, name: "Survey fixture", directoryVisibility: "building" })),
        );
      await tx
        .insert(s.buildings)
        .values(
          buildings.map((id, i) => ({ id, projectId: projects[i === 2 ? 1 : 0], name: `B${i}` })),
        );
      for (let i = 0; i < users.length; i++) {
        const buildingId = buildings[i === 11 ? 2 : i % 2],
          floor = uuid();
        await tx.insert(s.floors).values({ id: floor, buildingId, number: i });
        await tx
          .insert(s.apartments)
          .values({ id: apartments[i], buildingId, floorId: floor, number: `${i}` });
        await tx.insert(s.parties).values({ id: persons[i], kind: "person" });
        await tx
          .insert(s.people)
          .values({ partyId: persons[i], fullName: "Fixture", isChild: users[i] === child });
        await tx.insert(s.households).values({
          id: homes[i],
          apartmentId: apartments[i],
          displayName: "Fixture",
          approvalStatus:
            users[i] === pending ? "pending" : users[i] === rejected ? "rejected" : "approved",
          isActive: users[i] !== inactive,
        });
        if (
          [adult, roommate, child, managed, pending, rejected, inactive, outsider].includes(
            users[i],
          )
        ) {
          await tx
            .insert(s.userPersonLinks)
            .values({ userId: users[i], personId: persons[i], verifiedBy: admin });
          await tx.insert(s.householdMembers).values({
            householdId: users[i] === roommate ? homes[1] : homes[i],
            personId: persons[i],
            isManagedChild: users[i] === managed,
          });
        }
      }
      const invitation = uuid();
      await tx.insert(s.invitations).values({
        id: invitation,
        projectId: projects[0],
        buildingId: buildings[0],
        kind: "resident",
        recipientUserId: unlinked,
        recipientEmail: `${unlinked}@example.test`,
        tokenHash: uuid().replaceAll("-", "").repeat(2),
        createdBy: admin,
        expiresAt: new Date(Date.now() + 86400000),
      });
      await tx.insert(s.joinRequests).values({
        invitationId: invitation,
        userId: unlinked,
        apartmentId: apartments[8],
        fullName: "Historical approval",
        householdName: "Historical home",
        status: "approved",
        reviewedBy: admin,
        reviewedAt: new Date(),
      });
      // Same account in both buildings, and two non-representative adults in one home.
      await tx.insert(s.householdMembers).values({ householdId: homes[2], personId: persons[1] });
      await tx
        .insert(s.apartmentOwnerships)
        .values({ apartmentId: apartments[8], ownerPartyId: persons[8] });
      await tx.insert(s.staffAssignments).values([
        { userId: pm, projectId: projects[0], role: "project_manager" },
        ...buildings.slice(0, 2).map((buildingId) => ({
          userId: bm,
          projectId: projects[0],
          buildingId,
          role: "building_manager",
        })),
      ]);
    });
    published = await survey();
    draft = await survey(projects[0], false);
    foreign = await survey(projects[1]);
  });
  afterAll(async () => {
    if (!fixture) return;
    await fixture.client`delete from projects where id in ${fixture.client(projects)}`;
    await fixture.client`delete from user_person_links where user_id in ${fixture.client(users)}`;
    await fixture.client`delete from parties where id in ${fixture.client(persons)}`;
    await fixture.client`delete from app_users where id in ${fixture.client(users)}`;
    await fixture.client.end();
  });
  it("enforces the residency and exact manager matrix without draft or foreign-resource oracles", async () => {
    for (const user of users) {
      const resident = [adult, roommate].includes(user),
        manager = [admin, pm].includes(user);
      expect((await list(await request("GET", user), context())).status).toBe(resident ? 200 : 404);
      const result = await read(user);
      expect(result.status).toBe(resident || manager ? 200 : 404);
      if (manager) expect((await result.json()).ownResponse).toBeNull();
      expect((await read(user, draft.id)).status).toBe(404);
      expect((await read(user, foreign.id)).status).toBe(404);
      expect((await vote(user, draft)).status).toBe(404);
      if (!resident) expect((await vote(user)).status).toBe(404);
    }
    expect((await read(outsider, foreign.id, projects[1])).status).toBe(200);
    expect((await read(adult, foreign.id, projects[1])).status).toBe(404);
    expect((await vote(adult, foreign, foreign.options[0], projects[1])).status).toBe(404);
    expect((await vote(adult, published, foreign.options[0])).status).toBe(400);
  });
  it("keeps one final account answer under concurrent identical/different choices", async () => {
    for (const identical of [true, false]) {
      const f = await survey();
      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, i) => vote(adult, f, f.options[identical ? 0 : i % 2])),
      );
      expect(responses.map((r) => r.status).sort()).toEqual(
        identical ? [200, 200, 200, 200, 200, 200] : [200, 200, 200, 409, 409, 409],
      );
      const rows =
        await fixture.client`select * from community_survey_responses where survey_id = ${f.id}`;
      expect(rows).toHaveLength(1);
      expect((await vote(adult, f, rows[0].option_id)).status).toBe(200);
      expect((await vote(roommate, f)).status).toBe(200);
      const dto = await (await read(adult, f.id)).json();
      expect(dto.ownResponse).toEqual({ optionId: rows[0].option_id });
      expect(Object.keys(dto).sort()).toEqual([
        "closedAt",
        "id",
        "options",
        "ownResponse",
        "publishedAt",
        "question",
        "state",
      ]);
      expect(dto.options).toEqual(
        f.options.map((id, i) => ({ id, label: `Choice ${i}`, position: i + 1 })),
      );
      expect((await (await read(pm, f.id)).json()).ownResponse).toBeNull();
      await fixture.client`update community_surveys set state = 'closed', closed_at = clock_timestamp() where id = ${f.id}`;
      const retry = await vote(adult, f, rows[0].option_id);
      expect(retry.status).toBe(409);
      expect(await retry.json()).toEqual({ error: "SURVEY_CLOSED" });
      expect((await (await read(adult, f.id)).json()).ownResponse).toEqual({
        optionId: rows[0].option_id,
      });
    }
  });
  it("combines admin and residency independently and hides historical own answers after removal", async () => {
    const f = await survey();
    await fixture.client`insert into user_person_links(user_id, person_id, verified_by) values (${admin}, ${persons[0]}, ${admin})`;
    await fixture.client`insert into household_members(person_id, household_id) values (${persons[0]}, ${homes[1]})`;
    expect((await vote(admin, f)).status).toBe(200);
    expect((await (await read(admin, f.id)).json()).ownResponse).toEqual({
      optionId: f.options[0],
    });
    await fixture.client`delete from household_members where person_id = ${persons[0]}`;
    expect((await (await read(admin, f.id)).json()).ownResponse).toBeNull();
    expect((await vote(admin, f)).status).toBe(404);
    expect(
      await fixture.client`select * from community_survey_responses where survey_id = ${f.id}`,
    ).toHaveLength(1);
  });
  it("paginates stable summaries without counts, options or identities", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) ids.push((await survey()).id);
    const first = await (await list(await request(), context())).json();
    const again = await (await list(await request(), context())).json();
    const second = await (
      await list(await request("GET", adult, undefined, "?page=2"), context())
    ).json();
    expect(first).toEqual(again);
    expect(first.surveys).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(new Set([...first.surveys, ...second.surveys].map((row) => row.id)).size).toBe(
      first.surveys.length + second.surveys.length,
    );
    expect(Object.keys(first.surveys[0]).sort()).toEqual([
      "closedAt",
      "id",
      "publishedAt",
      "question",
      "state",
    ]);
  });
  it("revokes reads/writes immediately and preserves historical answers", async () => {
    const f = await survey();
    expect((await vote(roommate, f)).status).toBe(200);
    const person = persons[2],
      home = homes[1];
    for (const [revoke, restore] of [
      [
        () => fixture.client`update people set is_child = true where party_id = ${person}`,
        () => fixture.client`update people set is_child = false where party_id = ${person}`,
      ],
      [
        () =>
          fixture.client`update household_members set is_managed_child = true where person_id = ${person}`,
        () =>
          fixture.client`update household_members set is_managed_child = false where person_id = ${person}`,
      ],
      [
        () => fixture.client`update households set is_active = false where id = ${home}`,
        () => fixture.client`update households set is_active = true where id = ${home}`,
      ],
      [
        () => fixture.client`update households set approval_status = 'rejected' where id = ${home}`,
        () => fixture.client`update households set approval_status = 'approved' where id = ${home}`,
      ],
      [
        () => fixture.client`delete from household_members where person_id = ${person}`,
        () =>
          fixture.client`insert into household_members(person_id, household_id) values (${person}, ${home})`,
      ],
      [
        () => fixture.client`delete from user_person_links where user_id = ${roommate}`,
        () =>
          fixture.client`insert into user_person_links(user_id, person_id, verified_by) values (${roommate}, ${person}, ${admin})`,
      ],
    ]) {
      await revoke();
      expect((await read(roommate, f.id)).status).toBe(404);
      expect((await vote(roommate, f)).status).toBe(404);
      expect(
        await fixture.client`select option_id from community_survey_responses where survey_id = ${f.id}`,
      ).toHaveLength(1);
      await restore();
      expect((await read(roommate, f.id)).status).toBe(200);
    }
    await fixture.client`delete from staff_assignments where user_id = ${pm}`;
    expect((await read(pm)).status).toBe(404);
    await fixture.client`delete from global_roles where user_id = ${admin}`;
    expect((await read(admin)).status).toBe(404);
    await fixture.client`insert into global_roles(user_id, role) values (${admin}, 'admin')`;
  });
  async function waitForLock(count = 1) {
    await vi.waitFor(
      async () => {
        const rows =
          await fixture.client`select pid from pg_stat_activity where application_name = 'survey-resident-tests' and wait_event_type = 'Lock'`;
        expect(rows.length).toBeGreaterThanOrEqual(count);
      },
      { timeout: 3000, interval: 10 },
    );
  }
  it("serializes closure and in-flight revocation with a real lock wait and state recheck", async () => {
    for (const change of ["close", "membership", "link", "approval"] as const) {
      const f = await survey();
      let response!: Promise<Response>;
      await fixture.client.begin(async (tx) => {
        if (change === "close")
          await tx`update community_surveys set state = 'closed', closed_at = clock_timestamp() where id = ${f.id}`;
        if (change === "membership")
          await tx`delete from household_members where person_id = ${persons[2]}`;
        if (change === "link") await tx`delete from user_person_links where user_id = ${roommate}`;
        if (change === "approval")
          await tx`update households set approval_status = 'pending' where id = ${homes[1]}`;
        response = vote(roommate, f);
        await waitForLock();
      });
      expect((await response).status).toBe(change === "close" ? 409 : 404);
      expect(
        await fixture.client`select * from community_survey_responses where survey_id = ${f.id}`,
      ).toHaveLength(0);
      if (change === "membership")
        await fixture.client`insert into household_members(person_id, household_id) values (${persons[2]}, ${homes[1]})`;
      if (change === "link")
        await fixture.client`insert into user_person_links(user_id, person_id, verified_by) values (${roommate}, ${persons[2]}, ${admin})`;
      if (change === "approval")
        await fixture.client`update households set approval_status = 'approved' where id = ${homes[1]}`;
    }
  });
  it("holds residency and survey locks until an accepted vote commits", async () => {
    for (const change of ["close", "membership"] as const) {
      const f = await survey();
      let response!: Promise<Response>, mutation!: Promise<unknown>;
      await fixture.client.begin(async (tx) => {
        await tx`lock table community_survey_responses in share mode`;
        response = vote(roommate, f);
        await waitForLock();
        mutation = (
          change === "close"
            ? fixture.client`update community_surveys set state = 'closed', closed_at = clock_timestamp() where id = ${f.id}`
            : fixture.client`delete from household_members where person_id = ${persons[2]}`
        ).execute();
        await waitForLock(2);
      });
      expect((await response).status).toBe(200);
      await mutation;
      expect(
        await fixture.client`select * from community_survey_responses where survey_id = ${f.id}`,
      ).toHaveLength(1);
      expect((await vote(roommate, f)).status).toBe(change === "close" ? 409 : 404);
      if (change === "membership")
        await fixture.client`insert into household_members(person_id, household_id) values (${persons[2]}, ${homes[1]})`;
    }
  });
  it("requires signed sessions, validates boundaries and always sends private responses", async () => {
    const check = async (response: Response, status: number) => {
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
    };
    const anonymous = new Request(config.baseURL, { headers: { "x-user-id": admin } });
    await check(await list(anonymous, context()), 401);
    await check(await detail(anonymous, context(published.id)), 401);
    await check(await PUT(anonymous, context(published.id)), 401);
    await check(await read(), 200);
    await check(await read(unlinked), 404);
    for (const project of ["bad", uuid()])
      await check(await read(adult, published.id, project), 404);
    for (const id of ["bad", uuid()]) await check(await read(adult, id), 404);
    for (const query of ["?page=0", "?page=10001", "?page=1.5", "?page=1&page=2", "?userId=x"])
      await check(await list(await request("GET", adult, undefined, query), context()), 400);
    await check(
      await detail(await request("GET", adult, undefined, "?page=1"), context(published.id)),
      400,
    );
    for (const body of [
      { optionId: "bad" },
      { optionId: published.options[0], userId: admin },
      {},
      null,
    ])
      await check(await PUT(await request("PUT", adult, body), context(published.id)), 400);
    for (const [body, type, status] of [
      ['{"optionId":"x","optionId":"' + published.options[0] + '"}', "application/json", 400],
      ["{", "application/json", 400],
      [" ".repeat(16385), "application/json", 413],
      ["{}", "text/plain", 415],
      [new Uint8Array([0xff]), "application/json", 400],
    ] as const) {
      const headers = new Headers(cookies.get(adult));
      headers.set("origin", config.baseURL);
      headers.set("content-type", type);
      headers.set("content-length", "1");
      await check(
        await PUT(
          new Request(config.baseURL, { method: "PUT", headers, body }),
          context(published.id),
        ),
        status,
      );
    }
    for (const origin of ["https://evil.test", config.baseURL + "/", "null", ""]) {
      const req = await request("PUT", adult, { optionId: published.options[0] });
      req.headers.set("origin", origin);
      await check(await PUT(req, context(published.id)), 403);
    }
    await check(await vote(adult, published, published.options[0].toUpperCase()), 200);
    await check(await vote(adult, published, published.options[1]), 409);
  });
});
