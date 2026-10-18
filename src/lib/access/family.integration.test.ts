import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { readDirectory } from "./directory";
import { createProjectStructure } from "../db/project-structure";
import { readManagementHierarchy } from "./management";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET as family, PATCH as mutate } from "@/app/api/households/[id]/members/route";
import { GET as invitations, POST as invite } from "@/app/api/households/[id]/invitations/route";
import { DELETE as revoke } from "@/app/api/households/[id]/invitations/[invitationId]/route";
import { GET as context, POST as submit } from "@/app/api/join/[token]/route";
import { POST as review } from "@/app/api/management/projects/[projectId]/join-requests/[requestId]/route";
import { GET as queue } from "@/app/api/management/projects/[projectId]/join-requests/route";
import { GET as household } from "@/app/api/households/[id]/route";
const config = {
  baseURL: "https://family.test",
  secret: "family-integration-test-only-32-character-secret",
  googleClientId: "test",
  googleClientSecret: "test",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 5 });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("Private family profiles and reviewed existing-household invitations", () => {
  const [
    admin,
    rep,
    adult,
    outsider,
    manager,
    applicant,
    existing,
    badManager,
    second,
    childAccount,
  ] = Array.from({ length: 10 }, () => crypto.randomUUID());
  const users = [
    admin,
    rep,
    adult,
    outsider,
    manager,
    applicant,
    existing,
    badManager,
    second,
    childAccount,
  ];
  const [pRep, pAdult, pExisting, pChild] = Array.from({ length: 4 }, () => crypto.randomUUID());
  const people = [pRep, pAdult, pExisting, pChild];
  const [home, otherHome] = [crypto.randomUUID(), crypto.randomUUID()];
  const projects: string[] = [];
  let project: string,
    otherProject: string,
    building: string,
    apartment: string,
    otherApartment: string;
  let childMember: string;
  const hctx = (id = home) => ({ params: Promise.resolve({ id }) });
  const tctx = (token: string) => ({ params: Promise.resolve({ token }) });
  const qctx = () => ({ params: Promise.resolve({ projectId: project }) });
  const rctx = (requestId: string, pid = project) => ({
    params: Promise.resolve({ projectId: pid, requestId }),
  });
  async function request(
    method: string,
    user?: string,
    body?: unknown,
    origin = config.baseURL,
    page = 1,
  ) {
    const headers = new Headers(
      user ? (await (await fixture.auth.$context).test.login({ userId: user })).headers : undefined,
    );
    headers.set("origin", origin);
    headers.set("content-type", "application/json");
    headers.set("x-user-id", rep);
    return new Request(`${config.baseURL}/api/households/${home}/members?page=${page}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const get = async (user?: string, id = home, page = 1) =>
    family(await request("GET", user, undefined, config.baseURL, page), hctx(id));
  const write = async (user: string, body: unknown, id = home) =>
    mutate(await request("PATCH", user, body), hctx(id));
  const issue = async (user = rep, body: unknown = { expiresInDays: 7 }, id = home) =>
    invite(await request("POST", user, body), hctx(id));
  const claim = async (
    token: string,
    user = applicant,
    body: unknown = { fullName: "Applicant adult" },
  ) => submit(await request("POST", user, body), tctx(token));
  async function newInvite(user = rep, body: unknown = { expiresInDays: 7 }) {
    const response = await issue(user, body);
    expect(response.status).toBe(201);
    const data = await response.json();
    return { ...data, token: data.url.split("/").pop() as string } as {
      id: string;
      url: string;
      token: string;
    };
  }
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({ id, email: `${id}@example.test`, name: "Account", emailVerified: true }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    for (let n = 0; n < 2; n++) {
      const created = await createProjectStructure(
        {
          name: `Family fixture ${n}`,
          buildings: [
            {
              name: "A",
              floors: [{ number: 0, apartments: [{ number: "1A" }, { number: "2B" }] }],
            },
          ],
        },
        fixture.db,
      );
      projects.push(created.projectId);
    }
    [project, otherProject] = projects;
    const a = (await readManagementHierarchy(fixture.db, admin, project))!.buildings[0];
    building = a.id;
    apartment = a.floors[0].apartments[0].id;
    otherApartment = (await readManagementHierarchy(fixture.db, admin, otherProject))!.buildings[0]
      .floors[0].apartments[0].id;
    await fixture.db.insert(s.households).values([
      {
        id: home,
        apartmentId: apartment,
        displayName: "Original family",
        approvalStatus: "approved",
        createdBy: outsider,
      },
      {
        id: otherHome,
        apartmentId: otherApartment,
        displayName: "Other family",
        approvalStatus: "approved",
      },
    ]);
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values(people.map((id) => ({ id, kind: "person" })));
      await tx.insert(s.people).values(
        people.map((id) => ({
          partyId: id,
          fullName: id === pChild ? "LEGACY PRIVATE CHILD" : id,
          isChild: id === pChild,
        })),
      );
    });
    await fixture.db.insert(s.householdMembers).values([
      { householdId: home, personId: pRep, isContactPerson: true },
      { householdId: home, personId: pAdult },
      { householdId: home, personId: pChild },
      { householdId: otherHome, personId: pExisting, isContactPerson: true },
    ]);
    await fixture.db.insert(s.userPersonLinks).values(
      [
        [rep, pRep],
        [adult, pAdult],
        [existing, pExisting],
        [childAccount, pChild],
      ].map(([userId, personId]) => ({ userId, personId, verifiedBy: admin })),
    );
    await fixture.db.insert(s.staffAssignments).values([
      { userId: manager, projectId: project, buildingId: building, role: "building_manager" },
      { userId: badManager, projectId: otherProject, role: "project_manager" },
    ]);
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      const links =
        await fixture.client`SELECT person_id FROM user_person_links WHERE user_id IN ${fixture.client(users)}`;
      const managed =
        await fixture.client`SELECT person_id FROM household_members WHERE household_id IN ${fixture.client([home, otherHome])} AND is_managed_child`;
      await fixture.client`DELETE FROM projects WHERE id IN ${fixture.client(projects)}`;
      await fixture.client`DELETE FROM user_person_links WHERE user_id IN ${fixture.client(users)}`;
      const all = [
        ...new Set([
          ...people,
          ...links.map((l) => l.person_id as string),
          ...managed.map((l) => l.person_id as string),
        ]),
      ];
      await fixture.client`DELETE FROM parties WHERE id IN ${fixture.client(all)}`;
      await fixture.client`DELETE FROM app_users WHERE id IN ${fixture.client(users)}`;
    } finally {
      await fixture.client.end();
    }
  });
  it("limits private family reads and mutations to the current verified adult representative", async () => {
    for (const [user, status] of [
      [undefined, 401],
      [admin, 404],
      [manager, 404],
      [outsider, 404],
      [adult, 404],
      [existing, 404],
      [childAccount, 404],
      [rep, 200],
    ] as const) {
      const response = await get(user);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
    }
    const data = await (await get(rep)).json();
    expect(data.members.some((m: { name: string }) => m.name === "LEGACY PRIVATE CHILD")).toBe(
      true,
    );
    expect(data.members.every((m: { editable: boolean }) => !m.editable)).toBe(true);
    expect((await get(rep, otherHome)).status).toBe(404);
    for (const user of [admin, manager, outsider, adult, childAccount]) {
      expect(
        (
          await write(user, {
            action: "addChild",
            requestId: crypto.randomUUID(),
            profile: { name: "No", relation: null },
          })
        ).status,
      ).toBe(404);
      expect((await issue(user)).status).toBe(404);
    }
  });
  it("creates private children atomically, deduplicates a saved retry and excludes children from all directory/detail DTOs", async () => {
    const input = {
      action: "addChild",
      requestId: crypto.randomUUID(),
      profile: { name: "PRIVATE NEW CHILD", relation: "Daughter" },
    };
    const first = await write(rep, input),
      secondResponse = await write(rep, input);
    expect(first.status).toBe(200);
    expect(await secondResponse.json()).toEqual(await first.json());
    const data = await (await get(rep)).json();
    const member = data.members.find((m: { name: string }) => m.name === input.profile.name);
    childMember = member.id;
    expect(member).toMatchObject({
      child: true,
      editable: true,
      representative: false,
      relation: "Daughter",
    });
    expect(
      (await write(rep, { ...input, profile: { ...input.profile, name: "Different" } })).status,
    ).toBe(409);
    for (const user of [rep, admin, manager, adult]) {
      expect(
        JSON.stringify(await (await household(await request("GET", user), hctx())).json()),
      ).not.toContain("PRIVATE NEW CHILD");
      expect(JSON.stringify(await readDirectory(fixture.db, user, project))).not.toContain(
        "PRIVATE NEW CHILD",
      );
    }
    expect(JSON.stringify(data)).not.toContain("personId");
    expect(JSON.stringify(data)).not.toContain("birthDate");
  });
  it("edits only created child profiles, detects stale edits and never changes linked identities or representative grants", async () => {
    const body = {
      action: "updateChild",
      id: childMember,
      expected: { name: "PRIVATE NEW CHILD", relation: "Daughter" },
      profile: { name: "PRIVATE UPDATED CHILD", relation: "Child" },
    };
    expect((await write(rep, body)).status).toBe(200);
    expect((await write(rep, body)).status).toBe(409);
    const adultMember = (await (await get(rep)).json()).members.find(
      (m: { name: string }) => m.name === pAdult,
    );
    expect(
      (
        await write(rep, {
          ...body,
          id: adultMember.id,
          expected: { name: pAdult, relation: null },
        })
      ).status,
    ).toBe(404);
    expect((await write(rep, { ...body }, otherHome)).status).toBe(404);
    expect(
      (
        await write(rep, {
          action: "addChild",
          requestId: crypto.randomUUID(),
          profile: { name: "Forged", relation: null, isChild: false },
          personId: pAdult,
          isContactPerson: true,
        })
      ).status,
    ).toBe(400);
  });
  it("rejects cross-origin, oversized and invalid pagination requests before mutation", async () => {
    expect(
      (
        await mutate(
          await request(
            "PATCH",
            rep,
            {
              action: "removeChild",
              id: childMember,
              expected: { name: "PRIVATE UPDATED CHILD", relation: "Child" },
            },
            "https://evil.test",
          ),
          hctx(),
        )
      ).status,
    ).toBe(403);
    expect((await write(rep, { junk: "x".repeat(4096) })).status).toBe(413);
    expect((await get(rep, home, 0)).status).toBe(400);
  });
  it("issues hash-only household-bound links without exposing child data and consumes them only on submit", async () => {
    const link = await newInvite();
    const [stored] =
      await fixture.client`SELECT household_id,apartment_id,token_hash,consumed_at FROM invitations WHERE id=${link.id}`;
    expect(stored.household_id).toBe(home);
    expect(stored.apartment_id).toBe(apartment);
    expect(stored.token_hash).not.toBe(link.token);
    expect(stored.consumed_at).toBeNull();
    const view = await context(await request("GET", applicant), tctx(link.token));
    expect(view.status).toBe(200);
    const data = await view.json();
    expect(data.kind).toBe("household_member");
    expect(data.apartments[0].number).toBe("1A");
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect(JSON.stringify(data)).not.toContain("Original family");
    expect((await claim(link.token, rep)).status).toBe(403);
    expect(
      (
        await claim(link.token, applicant, {
          fullName: "New adult",
          apartmentId: otherApartment,
          householdName: "Takeover",
        })
      ).status,
    ).toBe(400);
    const accepted = await claim(link.token);
    expect(accepted.status).toBe(200);
    const saved = await accepted.json();
    expect(await (await claim(link.token)).json()).toEqual(saved);
    expect((await household(await request("GET", applicant), hctx())).status).toBe(404);
    const reviewerQueue = await (await queue(await request("GET", manager), qctx())).json();
    expect(reviewerQueue.requests.find((r: { id: string }) => r.id === saved.id)).toMatchObject({
      kind: "household_member",
      invitationActive: true,
      canReview: true,
      householdName: null,
    });
    expect(
      (await review(await request("POST", rep, { decision: "approve" }), rctx(saved.id))).status,
    ).toBe(404);
    expect(
      (
        await review(
          await request("POST", badManager, { decision: "approve" }),
          rctx(saved.id, otherProject),
        )
      ).status,
    ).toBe(404);
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(saved.id)))
        .status,
    ).toBe(200);
    const [homeRow] =
      await fixture.client`SELECT display_name,apartment_id FROM households WHERE id=${home}`;
    expect(homeRow.display_name).toBe("Original family");
    expect(homeRow.apartment_id).toBe(apartment);
    const [membership] =
      await fixture.client`SELECT hm.is_contact_person,p.is_child FROM household_members hm JOIN user_person_links u ON u.person_id=hm.person_id JOIN people p ON p.party_id=hm.person_id WHERE hm.household_id=${home} AND u.user_id=${applicant}`;
    expect(membership).toMatchObject({ is_contact_person: false, is_child: false });
    expect((await get(applicant)).status).toBe(404);
    expect((await household(await request("GET", applicant), hctx())).status).toBe(200);
  });
  it("reuses an existing global person across projects and grants no representative role or duplicate membership", async () => {
    for (let n = 0; n < 2; n++) {
      const link = await newInvite();
      const submitted = await (
        await claim(link.token, existing, { fullName: "Ignored replacement name" })
      ).json();
      expect(
        (await review(await request("POST", manager, { decision: "approve" }), rctx(submitted.id)))
          .status,
      ).toBe(200);
    }
    expect(
      (await fixture.client`SELECT full_name FROM people WHERE party_id=${pExisting}`)[0].full_name,
    ).toBe(pExisting);
    const rows =
      await fixture.client`SELECT household_id,is_contact_person FROM household_members WHERE person_id=${pExisting}`;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.household_id === home)?.is_contact_person).toBe(false);
    expect(rows.find((r) => r.household_id === otherHome)?.is_contact_person).toBe(true);
    expect((await get(existing)).status).toBe(404);
    expect((await get(existing, otherHome)).status).toBe(200);
  });
  it("restricts recipient identities and rejects child-linked applicants without creating or merging people", async () => {
    const restricted = await newInvite(rep, {
      recipientEmail: `${second}@example.test`,
      expiresInDays: 7,
    });
    expect((await claim(restricted.token, outsider)).status).toBe(404);
    const childLink = await newInvite();
    const submitted = await (await claim(childLink.token, childAccount)).json();
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(submitted.id)))
        .status,
    ).toBe(409);
    expect(
      (
        await fixture.client`SELECT person_id FROM user_person_links WHERE user_id=${childAccount}`
      )[0].person_id,
    ).toBe(pChild);
  });
  it("revalidates the issuing representative on reads, claims and approvals even if they are also an admin", async () => {
    const link = await newInvite();
    const pending = await (await claim(link.token, outsider)).json();
    await fixture.db.insert(s.globalRoles).values({ userId: rep, role: "admin" });
    await fixture.client`UPDATE household_members SET is_contact_person=false WHERE household_id=${home} AND person_id=${pRep}`;
    expect((await get(rep)).status).toBe(404);
    expect((await issue(rep)).status).toBe(404);
    const data = await (await queue(await request("GET", manager), qctx())).json();
    expect(data.requests.find((r: { id: string }) => r.id === pending.id).invitationActive).toBe(
      false,
    );
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(pending.id)))
        .status,
    ).toBe(409);
    expect((await context(await request("GET", second), tctx(link.token))).status).toBe(404);
    await fixture.client`UPDATE household_members SET is_contact_person=true WHERE household_id=${home} AND person_id=${pRep}`;
  });
  it("revokes and expires household invitations without removing previously approved members", async () => {
    const link = await newInvite();
    const pending = await (await claim(link.token, second)).json();
    expect(
      (
        await revoke(await request("DELETE", adult), {
          params: Promise.resolve({ id: home, invitationId: link.id }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await revoke(await request("DELETE", rep), {
          params: Promise.resolve({ id: home, invitationId: link.id }),
        })
      ).status,
    ).toBe(200);
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(pending.id)))
        .status,
    ).toBe(409);
    expect(
      (await review(await request("POST", manager, { decision: "reject" }), rctx(pending.id)))
        .status,
    ).toBe(200);
    expect((await household(await request("GET", applicant), hctx())).status).toBe(200);
    const expired = await newInvite();
    await fixture.client`UPDATE invitations SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=${expired.id}`;
    expect((await claim(expired.token, second)).status).toBe(404);
  });
  it("never transfers an invitation to a replacement household in the same apartment", async () => {
    const link = await newInvite();
    const pending = await (await claim(link.token, outsider)).json();
    const replacement = crypto.randomUUID();
    await fixture.client`UPDATE households SET is_active=false WHERE id=${home}`;
    await fixture.db
      .insert(s.households)
      .values({
        id: replacement,
        apartmentId: apartment,
        displayName: "Replacement",
        approvalStatus: "approved",
      });
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(pending.id)))
        .status,
    ).toBe(409);
    expect((await context(await request("GET", second), tctx(link.token))).status).toBe(404);
    expect(
      await fixture.client`SELECT id FROM household_members WHERE household_id=${replacement}`,
    ).toHaveLength(0);
    await fixture.client`DELETE FROM households WHERE id=${replacement}`;
    await fixture.client`UPDATE households SET is_active=true WHERE id=${home}`;
  });
  it("prevents cross-apartment household binding and invalid representative profile flags at the database boundary", async () => {
    const link = await newInvite();
    await expect(
      fixture.client`UPDATE invitations SET household_id=${otherHome} WHERE id=${link.id}`,
    ).rejects.toThrow();
    await expect(
      fixture.client`UPDATE household_members SET is_contact_person=true WHERE id=${childMember}`,
    ).rejects.toThrow();
  });
  it("removes only an owned private child profile and rejects stale/cross-household removal", async () => {
    const input = {
      action: "removeChild",
      id: childMember,
      expected: { name: "PRIVATE UPDATED CHILD", relation: "Child" },
    };
    expect(
      (await write(rep, { ...input, expected: { name: "Old", relation: "Child" } })).status,
    ).toBe(409);
    expect((await write(rep, input, otherHome)).status).toBe(404);
    expect((await write(rep, input)).status).toBe(200);
    expect((await write(rep, input)).status).toBe(404);
    expect(
      await fixture.client`SELECT party_id FROM people WHERE full_name='PRIVATE UPDATED CHILD'`,
    ).toHaveLength(0);
  });
  it("paginates private children and serializes concurrent additions at the household limit", async () => {
    const count = (
      await fixture.client`SELECT count(*)::int AS n FROM household_members WHERE household_id=${home}`
    )[0].n as number;
    const ids = Array.from({ length: 49 - count }, () => crypto.randomUUID());
    people.push(...ids);
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values(ids.map((id) => ({ id, kind: "person" })));
      await tx
        .insert(s.people)
        .values(
          ids.map((id) => ({ partyId: id, fullName: "PRIVATE PAGING CHILD", isChild: true })),
        );
      await tx
        .insert(s.householdMembers)
        .values(ids.map((personId) => ({ householdId: home, personId, isManagedChild: true })));
    });
    const first = await (await get(rep)).json(),
      third = await (await get(rep, home, 3)).json();
    expect(first.members).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(third.members).toHaveLength(9);
    expect(third.hasNext).toBe(false);
    const responses = await Promise.all(
      ["A", "B"].map((name) =>
        write(rep, {
          action: "addChild",
          requestId: crypto.randomUUID(),
          profile: { name, relation: null },
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await (await get(rep)).json()).canAdd).toBe(false);
    const link = await newInvite();
    const submitted = await (await claim(link.token, second)).json();
    expect(
      (await review(await request("POST", manager, { decision: "approve" }), rctx(submitted.id)))
        .status,
    ).toBe(409);
    expect(
      await fixture.client`SELECT person_id FROM user_person_links WHERE user_id=${second}`,
    ).toHaveLength(0);
  });
});
