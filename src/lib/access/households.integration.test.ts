import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "../../../drizzle/schema";
import { createAuth } from "../auth/create-auth";
import { readDirectory } from "./directory";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => fixture.auth }));
vi.mock("@/lib/auth/config", () => ({ readAuthConfig: () => config }));
vi.mock("@/lib/db/client", () => ({
  get db() {
    return fixture.db;
  },
}));
import { GET as detail, PATCH as patch } from "@/app/api/households/[id]/route";
import { GET as mine } from "@/app/api/households/route";
const config = {
  baseURL: "https://household.test",
  secret: "household-integration-only-32-character-secret",
  googleClientId: "test",
  googleClientSecret: "test",
};
const url = process.env.AUTH_TEST_DATABASE_URL;
function setup() {
  const client = postgres(url!, { max: 4 });
  const db = drizzle(client, { schema: s });
  return {
    client,
    db,
    auth: betterAuth({ ...createAuth(db, config).options, plugins: [testUtils()] }),
  };
}
let fixture: ReturnType<typeof setup>;
describe.skipIf(!url)("Live household privacy and self-service with signed sessions", () => {
  const [admin, rep, adult, neighbor, otherResident, manager, outsider, childUser] = Array.from(
    { length: 8 },
    () => crypto.randomUUID(),
  );
  const users = [admin, rep, adult, neighbor, otherResident, manager, outsider, childUser];
  const [
    project,
    otherProject,
    a,
    b,
    c,
    fa,
    fb,
    fc,
    aa,
    ab,
    ac,
    home,
    homeB,
    homeC,
    pRep,
    pAdult,
    pNeighbor,
    pOther,
    pChild,
  ] = Array.from({ length: 19 }, () => crypto.randomUUID());
  const people = [pRep, pAdult, pNeighbor, pOther, pChild];
  const contacts = ["managers", "building", "project"].map((visibility) => ({
    kind: "phone" as const,
    value:
      visibility === "managers"
        ? "0501111111"
        : visibility === "building"
          ? "0502222222"
          : "0503333333",
    label: null,
    visibility: visibility as "managers" | "building" | "project",
  }));
  const ctx = (id = home) => ({ params: Promise.resolve({ id }) });
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
    headers.set("content-type", "application/json");
    headers.set("origin", origin);
    headers.set("x-user-id", rep);
    return new Request(`${config.baseURL}/api/households/${home}?page=${page}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  const get = async (user?: string, id = home, page = 1) =>
    detail(await request("GET", user, undefined, config.baseURL, page), ctx(id));
  const write = async (user: string, body: unknown, id = home) =>
    patch(await request("PATCH", user, body), ctx(id));
  beforeAll(async () => {
    fixture = setup();
    const test = (await fixture.auth.$context).test;
    for (const id of users)
      await test.saveUser(
        test.createUser({ id, email: `${id}@example.test`, name: "Fixture", emailVerified: true }),
      );
    await fixture.db.insert(s.globalRoles).values({ userId: admin, role: "admin" });
    await fixture.db.insert(s.projects).values([
      { id: project, name: "Main" },
      { id: otherProject, name: "Other" },
    ]);
    await fixture.db.insert(s.buildings).values([
      { id: a, projectId: project, name: "A" },
      { id: b, projectId: project, name: "B" },
      { id: c, projectId: otherProject, name: "C" },
    ]);
    await fixture.db.insert(s.floors).values([
      { id: fa, buildingId: a, number: 0 },
      { id: fb, buildingId: b, number: 1 },
      { id: fc, buildingId: c, number: 2 },
    ]);
    await fixture.db.insert(s.apartments).values([
      { id: aa, buildingId: a, floorId: fa, number: "1A" },
      { id: ab, buildingId: b, floorId: fb, number: "2" },
      { id: ac, buildingId: c, floorId: fc, number: "3" },
    ]);
    await fixture.db.insert(s.households).values([
      {
        id: home,
        apartmentId: aa,
        displayName: "Original",
        approvalStatus: "approved",
        createdBy: outsider,
      },
      { id: homeB, apartmentId: ab, displayName: "Neighbors", approvalStatus: "approved" },
      { id: homeC, apartmentId: ac, displayName: "Other home", approvalStatus: "approved" },
    ]);
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values(people.map((id) => ({ id, kind: "person" })));
      await tx.insert(s.people).values(
        people.map((id) => ({
          partyId: id,
          fullName: id === pChild ? "HIDDEN CHILD" : id,
          isChild: id === pChild,
        })),
      );
    });
    await fixture.db.insert(s.householdMembers).values([
      { householdId: home, personId: pRep, isContactPerson: true },
      { householdId: home, personId: pAdult },
      { householdId: home, personId: pChild },
      { householdId: homeB, personId: pNeighbor },
      { householdId: homeC, personId: pRep, isContactPerson: true },
      { householdId: homeC, personId: pOther },
    ]);
    await fixture.db.insert(s.userPersonLinks).values(
      [
        [rep, pRep],
        [adult, pAdult],
        [neighbor, pNeighbor],
        [otherResident, pOther],
        [childUser, pChild],
      ].map(([userId, personId]) => ({ userId, personId, verifiedBy: admin })),
    );
    await fixture.db
      .insert(s.staffAssignments)
      .values({ userId: manager, projectId: project, buildingId: a, role: "building_manager" });
    await fixture.db
      .insert(s.contactMethods)
      .values(people.flatMap((partyId) => contacts.map((contact) => ({ ...contact, partyId }))));
  });
  afterAll(async () => {
    if (!fixture) return;
    try {
      await fixture.client`DELETE FROM projects WHERE id IN ${fixture.client([project, otherProject])}`;
      await fixture.client`DELETE FROM user_person_links WHERE user_id IN ${fixture.client(users)}`;
      await fixture.client`DELETE FROM parties WHERE id IN ${fixture.client(people)}`;
      await fixture.client`DELETE FROM app_users WHERE id IN ${fixture.client(users)}`;
    } finally {
      await fixture.client.end();
    }
  });
  it("authenticates actual sessions and ignores forged identity headers; every response is private", async () => {
    for (const [response, status] of [
      [await get(), 401],
      [await get(outsider), 404],
      [await get(rep, "bad"), 404],
      [await get(rep, crypto.randomUUID()), 404],
      [await get(rep), 200],
    ] as const) {
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("vary")).toBe("Cookie");
    }
    const expired = await request("GET", rep);
    await fixture.client`UPDATE auth_sessions SET expires_at = now() - interval '1 day' WHERE user_id = ${rep}`;
    expect((await detail(expired, ctx())).status).toBe(401);
  });
  it("discovers caller-owned approved homes across projects without conflating manager grants", async () => {
    expect(
      (await (await mine(await request("GET", rep))).json()).households
        .map((h: { id: string }) => h.id)
        .sort(),
    ).toEqual([home, homeC].sort());
    for (const user of [admin, manager, outsider, childUser])
      expect((await (await mine(await request("GET", user))).json()).households).toEqual([]);
    const data = await (await get(rep)).json();
    expect(data.canRename).toBe(true);
    expect(data.ownContacts).toHaveLength(3);
    expect(data.floor).toBe(0);
    expect(data.apartment).toBe("1A");
    expect((await (await get(adult)).json()).canRename).toBe(false);
  });
  it("filters private contacts in SQL, never exposes children/ownership/birth dates and enforces building boundaries", async () => {
    const data = await (await get(neighbor)).json();
    expect(data.ownContacts).toBeNull();
    expect(data.canRename).toBe(false);
    expect(data.members).toHaveLength(2);
    expect(data.members.every((m: { contacts: unknown[] }) => m.contacts.length === 1)).toBe(true);
    expect(JSON.stringify(data)).not.toContain("0501111111");
    expect(JSON.stringify(data)).not.toContain("HIDDEN CHILD");
    expect(JSON.stringify(data)).not.toContain("birthDate");
    expect(JSON.stringify(data)).not.toContain("ownership");
    expect((await get(otherResident)).status).toBe(404);
    expect(
      (await (await get(manager)).json()).members.every(
        (m: { contacts: unknown[] }) => m.contacts.length === 3,
      ),
    ).toBe(true);
    expect((await get(manager, homeB)).status).toBe(404);
    await fixture.client`UPDATE projects SET directory_visibility = 'building' WHERE id = ${project}`;
    expect((await get(neighbor)).status).toBe(404);
    await fixture.client`UPDATE projects SET directory_visibility = 'community' WHERE id = ${project}`;
  });
  it("restricts household renaming to linked adult contact representatives and preserves identity/other memberships", async () => {
    for (const user of [admin, manager, outsider, neighbor, adult, childUser])
      expect(
        (await write(user, { action: "rename", name: "No", expected: "Original" })).status,
      ).toBe(404);
    expect(
      (await write(rep, { action: "rename", name: "Updated", expected: "Original" })).status,
    ).toBe(200);
    expect((await (await get(rep)).json()).name).toBe("Updated");
    expect((await (await get(rep, homeC)).json()).name).toBe("Other home");
    expect(
      (await write(rep, { action: "rename", name: "Lost", expected: "Original" })).status,
    ).toBe(409);
    expect(
      (await fixture.client`SELECT full_name FROM people WHERE party_id=${pRep}`)[0].full_name,
    ).toBe(pRep);
    expect(
      (await readDirectory(fixture.db, neighbor, project))?.residents.find(
        (r) => r.householdId === home,
      )?.householdName,
    ).toBe("Updated");
  });
  it("creates, changes privacy and deletes only the caller's contacts with changes visible in every project", async () => {
    const contact = {
      kind: "email",
      value: "self@example.test",
      label: "Personal",
      visibility: "managers",
    };
    expect((await write(rep, { action: "addContact", contact })).status).toBe(200);
    const found = (await (await get(rep)).json()).ownContacts.find(
      (c: { value: string }) => c.value === contact.value,
    );
    expect(found).toBeTruthy();
    expect((await (await get(rep, homeC)).json()).ownContacts).toContainEqual(found);
    expect(JSON.stringify(await (await get(neighbor)).json())).not.toContain(contact.value);
    for (const user of [adult, neighbor, manager, admin])
      expect(
        (await write(user, { action: "deleteContact", id: found.id, expected: contact })).status,
      ).toBe(404);
    const updated = { ...contact, visibility: "project" };
    expect(
      (
        await write(rep, {
          action: "updateContact",
          id: found.id,
          expected: contact,
          contact: updated,
        })
      ).status,
    ).toBe(200);
    expect(JSON.stringify(await (await get(neighbor)).json())).toContain(contact.value);
    expect(JSON.stringify(await (await get(otherResident, homeC)).json())).toContain(contact.value);
    expect(
      (await write(rep, { action: "deleteContact", id: found.id, expected: contact })).status,
    ).toBe(409);
    expect(
      (await write(rep, { action: "deleteContact", id: found.id, expected: updated })).status,
    ).toBe(200);
    expect(JSON.stringify(await (await get(otherResident, homeC)).json())).not.toContain(
      contact.value,
    );
  });
  it("serializes simultaneous edits across households and rejects duplicate contact retries", async () => {
    const responses = await Promise.all([
      write(rep, { action: "rename", expected: "Updated", name: "Concurrent A" }),
      write(rep, { action: "rename", expected: "Updated", name: "Concurrent B" }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const contact = {
      kind: "email",
      value: "race@example.test",
      label: null,
      visibility: "building",
    };
    const additions = await Promise.all([
      write(rep, { action: "addContact", contact }),
      write(rep, { action: "addContact", contact }, homeC),
    ]);
    expect(additions.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await (await get(rep)).json()).ownContacts.filter(
        (c: { value: string }) => c.value === contact.value,
      ),
    ).toHaveLength(1);
  });
  it("validates strict payloads, rejects cross-origin writes and bounds body/page sizes", async () => {
    for (const body of [
      { action: "rename", expected: "", name: "", personId: pAdult },
      {
        action: "addContact",
        contact: { kind: "phone", value: "-----", label: null, visibility: "project" },
      },
      {
        action: "addContact",
        contact: { kind: "email", value: "javascript:bad", label: null, visibility: "project" },
      },
    ])
      expect((await write(rep, body)).status).toBe(400);
    expect(
      (
        await patch(
          await request(
            "PATCH",
            rep,
            { action: "rename", expected: "", name: "X" },
            "https://evil.test",
          ),
          ctx(),
        )
      ).status,
    ).toBe(403);
    expect((await write(rep, { junk: "x".repeat(4096) })).status).toBe(413);
    expect((await get(rep, home, 0)).status).toBe(400);
  });
  it("bounds member pages and serializes the maximum contact count", async () => {
    const extra = Array.from({ length: 21 }, () => crypto.randomUUID());
    people.push(...extra);
    await fixture.db.transaction(async (tx) => {
      await tx.insert(s.parties).values(extra.map((id) => ({ id, kind: "person" })));
      await tx
        .insert(s.people)
        .values(extra.map((id, i) => ({ partyId: id, fullName: `Paging ${i}` })));
    });
    await fixture.db
      .insert(s.householdMembers)
      .values(extra.map((personId) => ({ householdId: home, personId })));
    const first = await (await get(rep)).json(),
      second = await (await get(rep, home, 2)).json();
    expect(first.members).toHaveLength(20);
    expect(first.hasNext).toBe(true);
    expect(second.members).toHaveLength(3);
    expect(second.hasNext).toBe(false);
    expect(
      new Set([...first.members, ...second.members].map((m: { id: string }) => m.id)).size,
    ).toBe(23);
    const count = first.ownContacts.length;
    for (let n = count; n < 9; n++)
      expect(
        (
          await write(rep, {
            action: "addContact",
            contact: {
              kind: "email",
              value: `limit${n}@example.test`,
              label: null,
              visibility: "managers",
            },
          })
        ).status,
      ).toBe(200);
    const results = await Promise.all(
      ["a", "b"].map((n) =>
        write(rep, {
          action: "addContact",
          contact: {
            kind: "email",
            value: `last${n}@example.test`,
            label: null,
            visibility: "managers",
          },
        }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await (await get(rep)).json()).ownContacts).toHaveLength(10);
  });
  it("enforces current representative, person link, household approval and staff revocation", async () => {
    await fixture.client`UPDATE household_members SET is_contact_person=false WHERE household_id=${home} AND person_id=${pRep}`;
    expect((await write(rep, { action: "rename", name: "Denied", expected: "" })).status).toBe(404);
    expect((await (await get(rep)).json()).canRename).toBe(false);
    await fixture.client`UPDATE households SET approval_status='pending' WHERE id=${home}`;
    expect((await get(rep)).status).toBe(404);
    expect((await write(rep, { action: "addContact", contact: contacts[0] })).status).toBe(404);
    await fixture.client`UPDATE households SET approval_status='approved',is_active=false WHERE id=${home}`;
    expect((await get(rep)).status).toBe(404);
    await fixture.client`UPDATE households SET is_active=true WHERE id=${home}`;
    await fixture.client`DELETE FROM staff_assignments WHERE user_id=${manager}`;
    expect((await get(manager)).status).toBe(404);
    await fixture.client`DELETE FROM user_person_links WHERE user_id=${rep}`;
    expect((await get(rep)).status).toBe(404);
    expect((await write(rep, { action: "addContact", contact: contacts[0] })).status).toBe(404);
  });
});
