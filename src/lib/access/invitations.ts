import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import {
  invitationInput,
  joinInput,
  invitationPageSize,
  type InvitationInput,
  type JoinInput,
  type InvitationKind,
  type InvitationPage,
  type RequestPage,
  type JoinContext,
} from "./invitation-contracts";
import { managementPageSchema } from "./management-contracts";
import { MAX_DIRECTORY_PAGE } from "./contracts";
type Database = PostgresJsDatabase<typeof s>;
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Invite = typeof s.invitations.$inferSelect;
export class InvitationError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const missing = () => new InvitationError(404, "NOT_FOUND");
export const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const reusable = (i: Invite) => i.kind === "resident" && !i.apartmentId;
const live = (i: Invite) => !i.revokedAt && i.expiresAt.getTime() > Date.now();
const status = (v: string): "pending" | "approved" | "rejected" =>
  v === "approved" ? "approved" : v === "rejected" ? "rejected" : "pending";
const kind = (v: string) => v as InvitationKind;
async function grants(tx: Tx, userId: string, projectId: string, lock = false) {
  const adminQuery = tx
    .select({ role: s.globalRoles.role })
    .from(s.globalRoles)
    .where(and(eq(s.globalRoles.userId, userId), eq(s.globalRoles.role, "admin")));
  const admins = await (lock ? adminQuery.for("share") : adminQuery);
  if (admins.length) return { admin: true, all: true, buildings: [] as string[] };
  const query = tx
    .select({ role: s.staffAssignments.role, buildingId: s.staffAssignments.buildingId })
    .from(s.staffAssignments)
    .where(and(eq(s.staffAssignments.userId, userId), eq(s.staffAssignments.projectId, projectId)))
    .orderBy(s.staffAssignments.id);
  const staff = await (lock ? query.for("share") : query);
  return {
    admin: false,
    all: staff.some((g) => g.role === "project_manager"),
    buildings: staff
      .filter((g) => g.role === "building_manager" && g.buildingId)
      .map((g) => g.buildingId!),
  };
}
type Scope = Awaited<ReturnType<typeof grants>>;
function permitted(scope: Scope, i: Pick<Invite, "kind" | "buildingId">) {
  return (
    scope.admin ||
    (i.kind === "resident" &&
      (scope.all || (!!i.buildingId && scope.buildings.includes(i.buildingId))))
  );
}
function scopeWhere(scope: Scope) {
  return scope.admin
    ? sql`true`
    : and(
        eq(s.invitations.kind, "resident"),
        scope.all
          ? sql`true`
          : scope.buildings.length
            ? inArray(s.invitations.buildingId, scope.buildings)
            : sql`false`,
      );
}
// Correlated EXISTS checks keep queue revalidation bounded without loading raw issuer grants.
const issuerHasAuthority = sql<boolean>`(
  exists (select 1 from global_roles gr where gr.user_id = ${s.invitations.createdBy} and gr.role = 'admin')
  or (${s.invitations.kind} = 'resident' and exists (
    select 1 from staff_assignments sa
    where sa.user_id = ${s.invitations.createdBy} and sa.project_id = ${s.invitations.projectId}
      and (sa.role = 'project_manager' or (sa.role = 'building_manager' and sa.building_id = ${s.invitations.buildingId}))
  ))
)`;
async function actorScope(tx: Tx, userId: string, projectId: string, lock = false) {
  const scope = await grants(tx, userId, projectId, lock);
  if (!scope.all && !scope.buildings.length) throw missing();
  return scope;
}
async function issuer(tx: Tx, i: Invite, lock = false) {
  if (!permitted(await grants(tx, i.createdBy, i.projectId, lock), i)) throw missing();
}
async function recipient(tx: Tx, i: Invite, userId: string) {
  if (i.recipientUserId) {
    if (i.recipientUserId !== userId) throw missing();
    return;
  }
  if (!i.recipientEmail) return;
  const [user] = await tx
    .select({ email: s.appUsers.email, verified: s.appUsers.emailVerified })
    .from(s.appUsers)
    .where(eq(s.appUsers.id, userId));
  if (!user?.verified || user.email.toLowerCase() !== i.recipientEmail) throw missing();
}
async function project(tx: Tx, id: string) {
  const [p] = await tx
    .select({ id: s.projects.id, name: s.projects.name })
    .from(s.projects)
    .where(eq(s.projects.id, id));
  if (!p) throw missing();
  return p;
}
async function apartment(
  tx: Tx,
  i: Pick<Invite, "buildingId" | "projectId" | "apartmentId">,
  id: string,
) {
  const [row] = await tx
    .select({ id: s.apartments.id })
    .from(s.apartments)
    .innerJoin(s.buildings, eq(s.buildings.id, s.apartments.buildingId))
    .where(
      and(
        eq(s.apartments.id, id),
        eq(s.buildings.projectId, i.projectId),
        eq(s.buildings.id, i.buildingId!),
        i.apartmentId ? eq(s.apartments.id, i.apartmentId) : undefined,
      ),
    );
  if (!row) throw missing();
  return row;
}
export async function createInvitation(
  db: Database,
  userId: string,
  projectId: string,
  value: InvitationInput,
) {
  const input = invitationInput.parse(value);
  return db.transaction(async (tx) => {
    const scope = await actorScope(tx, userId, projectId, true);
    const buildingId = input.kind === "project_manager" ? null : input.buildingId;
    if (!permitted(scope, { kind: input.kind, buildingId })) throw missing();
    await project(tx, projectId);
    if (buildingId) {
      const [b] = await tx
        .select({ id: s.buildings.id })
        .from(s.buildings)
        .where(and(eq(s.buildings.id, buildingId), eq(s.buildings.projectId, projectId)));
      if (!b) throw missing();
    }
    const apartmentId = input.kind === "resident" ? input.apartmentId : null;
    if (apartmentId) await apartment(tx, { buildingId, projectId, apartmentId }, apartmentId);
    const matching = input.recipientEmail
      ? await tx
          .select({ id: s.appUsers.id })
          .from(s.appUsers)
          .where(
            and(
              sql`lower(${s.appUsers.email}) = ${input.recipientEmail}`,
              eq(s.appUsers.emailVerified, true),
            ),
          )
          .limit(2)
      : [];
    const token = randomBytes(32).toString("hex");
    const [row] = await tx
      .insert(s.invitations)
      .values({
        projectId,
        buildingId,
        apartmentId,
        kind: input.kind,
        recipientEmail: input.recipientEmail ?? null,
        recipientUserId: matching.length === 1 ? matching[0].id : null,
        tokenHash: hashInvitationToken(token),
        createdBy: userId,
        expiresAt: new Date(Date.now() + input.expiresInDays * 86400000),
      })
      .returning({ id: s.invitations.id });
    return { ...row, token };
  });
}
export async function listInvitations(
  db: Database,
  userId: string,
  projectId: string,
  page = 1,
): Promise<InvitationPage> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      const scope = await actorScope(tx, userId, projectId);
      await project(tx, projectId);
      const rows = await tx
        .select({
          id: s.invitations.id,
          kind: s.invitations.kind,
          buildingId: s.invitations.buildingId,
          apartmentId: s.invitations.apartmentId,
          recipientEmail: s.invitations.recipientEmail,
          expiresAt: s.invitations.expiresAt,
          revokedAt: s.invitations.revokedAt,
          consumedAt: s.invitations.consumedAt,
        })
        .from(s.invitations)
        .where(and(eq(s.invitations.projectId, projectId), scopeWhere(scope)))
        .orderBy(s.invitations.createdAt, s.invitations.id)
        .limit(invitationPageSize + 1)
        .offset((page - 1) * invitationPageSize);
      return {
        invitations: rows.slice(0, invitationPageSize).map((r) => ({
          id: r.id,
          kind: kind(r.kind),
          buildingId: r.buildingId,
          apartmentId: r.apartmentId,
          recipientEmail: r.recipientEmail,
          expiresAt: r.expiresAt.toISOString(),
          revoked: !!r.revokedAt,
          consumed: !!r.consumedAt,
        })),
        page,
        hasNext: rows.length > invitationPageSize && page < MAX_DIRECTORY_PAGE,
        canInviteStaff: scope.admin,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function revokeInvitation(
  db: Database,
  userId: string,
  projectId: string,
  id: string,
) {
  return db.transaction(async (tx) => {
    const scope = await actorScope(tx, userId, projectId, true);
    const [row] = await tx
      .update(s.invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(s.invitations.id, id), eq(s.invitations.projectId, projectId), scopeWhere(scope)),
      )
      .returning({ id: s.invitations.id });
    if (!row) throw missing();
    return row;
  });
}
async function byToken(tx: Tx, token: string, lock = false) {
  const query = tx
    .select()
    .from(s.invitations)
    .where(eq(s.invitations.tokenHash, hashInvitationToken(token)));
  const [i] = await (lock ? query.for("update") : query);
  if (!i) throw missing();
  return i;
}
export async function invitationContext(
  db: Database,
  userId: string,
  token: string,
  page = 1,
): Promise<JoinContext> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      const i = await byToken(tx, token);
      await recipient(tx, i, userId);
      const [own] = await tx
        .select({ id: s.joinRequests.id, status: s.joinRequests.status })
        .from(s.joinRequests)
        .where(and(eq(s.joinRequests.invitationId, i.id), eq(s.joinRequests.userId, userId)));
      let active = live(i) && (!i.consumedAt || !!own);
      try {
        await issuer(tx, i);
      } catch (error) {
        if (!(error instanceof InvitationError)) throw error;
        active = false;
      }
      if (!active && !own) throw missing();
      const p = await project(tx, i.projectId);
      const [building] = i.buildingId
        ? await tx
            .select({ name: s.buildings.name })
            .from(s.buildings)
            .where(eq(s.buildings.id, i.buildingId))
        : [];
      const apartments =
        active && i.kind === "resident" && !own
          ? await tx
              .select({ id: s.apartments.id, number: s.apartments.number, floor: s.floors.number })
              .from(s.apartments)
              .innerJoin(s.floors, eq(s.floors.id, s.apartments.floorId))
              .where(
                and(
                  eq(s.apartments.buildingId, i.buildingId!),
                  i.apartmentId ? eq(s.apartments.id, i.apartmentId) : undefined,
                ),
              )
              .orderBy(
                s.floors.number,
                sql`case when ${s.apartments.number} ~ '^[0-9]+$' then ${s.apartments.number}::numeric end asc nulls last`,
                s.apartments.number,
                s.apartments.id,
              )
              .limit(invitationPageSize + 1)
              .offset((page - 1) * invitationPageSize)
          : [];
      return {
        projectName: p.name,
        kind: kind(i.kind),
        buildingName: building?.name ?? null,
        fixedApartmentId: i.apartmentId,
        apartments: apartments.slice(0, invitationPageSize),
        page,
        hasNext: apartments.length > invitationPageSize && page < MAX_DIRECTORY_PAGE,
        request: own ? { id: own.id, status: status(own.status) } : null,
        active,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function submitJoin(db: Database, userId: string, token: string, value: JoinInput) {
  const input = joinInput.parse(value);
  return db.transaction(async (tx) => {
    const i = await byToken(tx, token, true);
    await recipient(tx, i, userId);
    const [own] = await tx
      .select({ id: s.joinRequests.id, status: s.joinRequests.status })
      .from(s.joinRequests)
      .where(and(eq(s.joinRequests.invitationId, i.id), eq(s.joinRequests.userId, userId)));
    if (own) return { id: own.id, status: status(own.status) };
    if (!live(i) || i.consumedAt) throw missing();
    await issuer(tx, i, true);
    if (i.kind === "resident") {
      if (!("apartmentId" in input)) throw new InvitationError(400, "INVALID_INPUT");
      await apartment(tx, i, input.apartmentId);
    } else if ("apartmentId" in input) throw new InvitationError(400, "INVALID_INPUT");
    const [row] = await tx
      .insert(s.joinRequests)
      .values({
        invitationId: i.id,
        userId,
        apartmentId: "apartmentId" in input ? input.apartmentId : null,
        fullName: "fullName" in input ? input.fullName : null,
        householdName: "householdName" in input ? input.householdName : null,
      })
      .returning({ id: s.joinRequests.id });
    if (!reusable(i))
      await tx
        .update(s.invitations)
        .set({ consumedAt: new Date() })
        .where(eq(s.invitations.id, i.id));
    return { ...row, status: "pending" as const };
  });
}
export async function listJoinRequests(
  db: Database,
  userId: string,
  projectId: string | null,
  page = 1,
): Promise<RequestPage> {
  page = managementPageSchema.parse(page);
  return db.transaction(
    async (tx) => {
      const scope = projectId ? await actorScope(tx, userId, projectId) : null;
      const rows = await tx
        .select({
          id: s.joinRequests.id,
          userId: s.joinRequests.userId,
          kind: s.invitations.kind,
          projectId: s.projects.id,
          projectName: s.projects.name,
          buildingName: s.buildings.name,
          apartmentNumber: s.apartments.number,
          fullName: s.joinRequests.fullName,
          householdName: s.joinRequests.householdName,
          status: s.joinRequests.status,
          accountName: s.appUsers.displayName,
          accountEmail: s.appUsers.email,
          expiresAt: s.invitations.expiresAt,
          revokedAt: s.invitations.revokedAt,
          issuerActive: issuerHasAuthority,
        })
        .from(s.joinRequests)
        .innerJoin(s.invitations, eq(s.invitations.id, s.joinRequests.invitationId))
        .innerJoin(s.projects, eq(s.projects.id, s.invitations.projectId))
        .innerJoin(s.appUsers, eq(s.appUsers.id, s.joinRequests.userId))
        .leftJoin(s.buildings, eq(s.buildings.id, s.invitations.buildingId))
        .leftJoin(s.apartments, eq(s.apartments.id, s.joinRequests.apartmentId))
        .where(
          projectId && scope
            ? and(eq(s.invitations.projectId, projectId), scopeWhere(scope))
            : eq(s.joinRequests.userId, userId),
        )
        .orderBy(s.joinRequests.createdAt, s.joinRequests.id)
        .limit(invitationPageSize + 1)
        .offset((page - 1) * invitationPageSize);
      return {
        requests: rows.slice(0, invitationPageSize).map((r) => ({
          id: r.id,
          kind: kind(r.kind),
          projectId: r.projectId,
          projectName: r.projectName,
          buildingName: r.buildingName,
          apartmentNumber: r.apartmentNumber,
          fullName: r.fullName,
          householdName: r.householdName,
          status: status(r.status),
          accountName: r.accountName,
          accountEmail: r.accountEmail,
          canReview: !!projectId && r.userId !== userId,
          invitationActive: r.issuerActive && !r.revokedAt && r.expiresAt.getTime() > Date.now(),
        })),
        page,
        hasNext: rows.length > invitationPageSize && page < MAX_DIRECTORY_PAGE,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function reviewJoinRequest(
  db: Database,
  reviewer: string,
  projectId: string,
  id: string,
  decision: "approve" | "reject",
) {
  return db.transaction(async (tx) => {
    const scope = await actorScope(tx, reviewer, projectId, true);
    const [candidate] = await tx
      .select({ invitationId: s.invitations.id })
      .from(s.joinRequests)
      .innerJoin(s.invitations, eq(s.invitations.id, s.joinRequests.invitationId))
      .where(
        and(eq(s.joinRequests.id, id), eq(s.invitations.projectId, projectId), scopeWhere(scope)),
      );
    if (!candidate) throw missing();
    const [i] = await tx
      .select()
      .from(s.invitations)
      .where(eq(s.invitations.id, candidate.invitationId))
      .for("update");
    const [request] = await tx
      .select()
      .from(s.joinRequests)
      .where(eq(s.joinRequests.id, id))
      .for("update");
    if (!request) throw missing();
    if (request.userId === reviewer) throw new InvitationError(403, "SELF_REVIEW");
    if (request.status !== "pending") throw new InvitationError(409, "REQUEST_REVIEWED");
    if (decision === "approve") {
      if (!live(i)) throw new InvitationError(409, "INVITATION_INACTIVE");
      try {
        await issuer(tx, i, true);
      } catch (error) {
        if (!(error instanceof InvitationError)) throw error;
        throw new InvitationError(409, "INVITATION_INACTIVE");
      }
      await recipient(tx, i, request.userId);
      // Serialize identity provisioning across independent invitations and projects.
      const [user] = await tx
        .select({ id: s.appUsers.id })
        .from(s.appUsers)
        .where(eq(s.appUsers.id, request.userId))
        .for("update");
      if (!user) throw missing();
      if (i.kind === "resident") {
        if (!request.apartmentId) throw missing();
        await apartment(tx, i, request.apartmentId);
        await tx
          .select({ id: s.apartments.id })
          .from(s.apartments)
          .where(eq(s.apartments.id, request.apartmentId))
          .for("update");
        const [occupied] = await tx
          .select({ id: s.households.id })
          .from(s.households)
          .where(
            and(eq(s.households.apartmentId, request.apartmentId), eq(s.households.isActive, true)),
          );
        if (occupied) throw new InvitationError(409, "APARTMENT_OCCUPIED");
        const [link] = await tx
          .select({ personId: s.userPersonLinks.personId })
          .from(s.userPersonLinks)
          .where(eq(s.userPersonLinks.userId, request.userId));
        let personId = link?.personId;
        if (personId) {
          const [person] = await tx
            .select({ child: s.people.isChild })
            .from(s.people)
            .where(eq(s.people.partyId, personId));
          if (!person || person.child) throw new InvitationError(409, "IDENTITY_UNAVAILABLE");
        } else {
          const [party] = await tx
            .insert(s.parties)
            .values({ kind: "person" })
            .returning({ id: s.parties.id });
          personId = party.id;
          await tx
            .insert(s.people)
            .values({ partyId: personId, fullName: request.fullName!, isChild: false });
          await tx
            .insert(s.userPersonLinks)
            .values({ userId: request.userId, personId, verifiedBy: reviewer });
        }
        const [home] = await tx
          .insert(s.households)
          .values({
            apartmentId: request.apartmentId,
            displayName: request.householdName!,
            approvalStatus: "approved",
            isActive: true,
            createdBy: request.userId,
          })
          .returning({ id: s.households.id });
        await tx
          .insert(s.householdMembers)
          .values({ householdId: home.id, personId, isContactPerson: true });
      } else {
        if (!scope.admin) throw missing();
        await tx
          .insert(s.staffAssignments)
          .values({ userId: request.userId, projectId, buildingId: i.buildingId, role: i.kind })
          .onConflictDoNothing();
      }
    }
    const next = decision === "approve" ? "approved" : "rejected";
    await tx
      .update(s.joinRequests)
      .set({ status: next, reviewedBy: reviewer, reviewedAt: new Date() })
      .where(eq(s.joinRequests.id, id));
    return { id, status: next };
  });
}
