import "server-only";
import { grantStaffRole, staffRoleStatus } from "./staff-role";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../../../drizzle/schema";
import {
  invitationInput,
  joinInput,
  invitationPageSize,
  type InvitationAcceptancePolicy,
  type InvitationInput,
  type CombinedStaff,
  type JoinInput,
  type InvitationKind,
  type InvitationPage,
  type RequestPage,
  type JoinContext,
  type JoinResult,
} from "./invitation-contracts";
import { managementPageSchema } from "./management-contracts";
import { familyRepresentative, MAX_FAMILY_MEMBERS } from "./family-access";
import { HouseholdError } from "./households";
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
const staffBuilding = alias(s.buildings, "staff_building");
function combinedStaff(
  invite: Pick<Invite, "staffRole" | "staffBuildingId">,
): CombinedStaff | undefined {
  if (invite.staffRole === "project_manager") return { role: invite.staffRole };
  if (invite.staffRole === "building_manager" && invite.staffBuildingId)
    return { role: invite.staffRole, buildingId: invite.staffBuildingId };
}
function combinedStaffDisplay(
  row: Pick<Invite, "staffRole" | "staffBuildingId"> & {
    staffBuildingName: string | null;
  },
) {
  const staff = combinedStaff(row);
  return staff && { ...staff, buildingName: row.staffBuildingName ?? undefined };
}
function permitted(scope: Scope, i: Pick<Invite, "kind" | "buildingId" | "staffRole">) {
  return (
    scope.admin ||
    (!i.staffRole &&
      (i.kind === "resident" || i.kind === "household_member") &&
      (scope.all || (!!i.buildingId && scope.buildings.includes(i.buildingId))))
  );
}
function scopeWhere(scope: Scope) {
  return scope.admin
    ? sql`true`
    : and(
        isNull(s.invitations.staffRole),
        inArray(s.invitations.kind, ["resident", "household_member"]),
        scope.all
          ? sql`true`
          : scope.buildings.length
            ? inArray(s.invitations.buildingId, scope.buildings)
            : sql`false`,
      );
}
// Correlated EXISTS checks keep queue revalidation bounded without loading raw issuer grants.
const issuerHasAuthority = sql<boolean>`(
  (${s.invitations.kind} <> 'household_member' and exists (select 1 from global_roles gr where gr.user_id = ${s.invitations.createdBy} and gr.role = 'admin'))
  or (${s.invitations.kind} = 'resident' and ${s.invitations.staffRole} is null and exists (
    select 1 from staff_assignments sa
    where sa.user_id = ${s.invitations.createdBy} and sa.project_id = ${s.invitations.projectId}
      and (sa.role = 'project_manager' or (sa.role = 'building_manager' and sa.building_id = ${s.invitations.buildingId}))
  ))
  or (${s.invitations.kind} = 'household_member' and exists (
    select 1 from user_person_links upl join people p on p.party_id=upl.person_id
    join household_members hm on hm.person_id=p.party_id
    join households h on h.id=hm.household_id
    where upl.user_id=${s.invitations.createdBy} and not p.is_child and hm.is_contact_person
      and h.id=${s.invitations.householdId} and h.is_active and h.approval_status='approved'
  ))
)`;
async function actorScope(tx: Tx, userId: string, projectId: string, lock = false) {
  const scope = await grants(tx, userId, projectId, lock);
  if (!scope.all && !scope.buildings.length) throw missing();
  return scope;
}
async function issuer(tx: Tx, i: Invite, lock = false) {
  if (i.kind === "household_member") {
    if (!i.householdId) throw missing();
    try {
      await familyRepresentative(tx, i.createdBy, i.householdId, lock ? "issuer" : false);
    } catch (error) {
      if (error instanceof HouseholdError) throw missing();
      throw error;
    }
    return null;
  }
  const scope = await grants(tx, i.createdBy, i.projectId, lock);
  if (!permitted(scope, i)) throw missing();
  return scope;
}
async function recipient(tx: Tx, i: Invite, userId: string, lock = false) {
  if (i.recipientUserId && i.recipientUserId !== userId) throw missing();
  const verifiedRequired = i.acceptancePolicy === "direct_acceptance";
  if (!verifiedRequired && (i.recipientUserId || !i.recipientEmail)) return;
  const query = tx
    .select({ email: s.appUsers.email, verified: s.appUsers.emailVerified })
    .from(s.appUsers)
    .where(eq(s.appUsers.id, userId));
  const [user] = await (lock ? query.for("no key update") : query);
  if (!user?.verified || (!i.recipientUserId && user.email.toLowerCase() !== i.recipientEmail))
    throw missing();
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
  lock = false,
) {
  const query = tx
    .select({ type: s.apartments.type })
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
  const [row] = await (lock ? query.for("update", { of: s.apartments }) : query);
  if (!row) throw missing();
  return row;
}
async function buildingInProject(tx: Tx, projectId: string, buildingId: string) {
  const [building] = await tx
    .select({ name: s.buildings.name })
    .from(s.buildings)
    .where(and(eq(s.buildings.id, buildingId), eq(s.buildings.projectId, projectId)));
  if (!building) throw missing();
  return building;
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
    const staff = input.kind === "resident" ? input.staff : undefined;
    const staffBuildingId = staff?.role === "building_manager" ? staff.buildingId : null;
    if (!permitted(scope, { kind: input.kind, buildingId, staffRole: staff?.role ?? null }))
      throw missing();
    await project(tx, projectId);
    if (buildingId) await buildingInProject(tx, projectId, buildingId);
    if (staffBuildingId && staffBuildingId !== buildingId)
      await buildingInProject(tx, projectId, staffBuildingId);
    const apartmentId = input.kind === "resident" ? input.apartmentId : null;
    const unit = apartmentId
      ? await apartment(tx, { buildingId, projectId, apartmentId }, apartmentId)
      : null;
    if (staff && unit?.type !== "residential") throw new InvitationError(400, "INVALID_INPUT");
    if (input.kind !== "resident")
      await checkStaffRecipient(tx, input.recipientEmail, projectId, input.kind, buildingId);
    return insertInvitation(
      tx,
      userId,
      {
        projectId,
        buildingId,
        apartmentId,
        kind: input.kind,
        staffRole: staff?.role,
        staffBuildingId,
      },
      {
        ...input,
        acceptancePolicy:
          unit?.type === "residential" && input.recipientEmail
            ? "direct_acceptance"
            : "manual_review",
      },
    );
  });
}
export async function insertInvitation(
  tx: Tx,
  userId: string,
  scope: {
    projectId: string;
    buildingId: string | null;
    apartmentId: string | null;
    householdId?: string | null;
    staffRole?: Invite["staffRole"];
    staffBuildingId?: string | null;
    kind: InvitationKind;
  },
  options: {
    recipientEmail?: string;
    expiresInDays: number;
    acceptancePolicy?: InvitationAcceptancePolicy;
  },
) {
  const matching = options.recipientEmail
    ? await tx
        .select({ id: s.appUsers.id })
        .from(s.appUsers)
        .where(
          and(
            sql`lower(${s.appUsers.email}) = ${options.recipientEmail}`,
            eq(s.appUsers.emailVerified, true),
          ),
        )
        .limit(2)
    : [];
  const token = randomBytes(32).toString("hex");
  const [row] = await tx
    .insert(s.invitations)
    .values({
      ...scope,
      acceptancePolicy: options.acceptancePolicy,
      recipientEmail: options.recipientEmail ?? null,
      recipientUserId: matching.length === 1 ? matching[0].id : null,
      tokenHash: hashInvitationToken(token),
      createdBy: userId,
      expiresAt: new Date(Date.now() + options.expiresInDays * 86400000),
    })
    .returning({ id: s.invitations.id });
  return { ...row, token };
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
          staffRole: s.invitations.staffRole,
          staffBuildingId: s.invitations.staffBuildingId,
          staffBuildingName: staffBuilding.name,
          expiresAt: s.invitations.expiresAt,
          revokedAt: s.invitations.revokedAt,
          consumedAt: s.invitations.consumedAt,
        })
        .from(s.invitations)
        .leftJoin(staffBuilding, eq(staffBuilding.id, s.invitations.staffBuildingId))
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
          staff: combinedStaffDisplay(r),
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
        (active && (i.kind === "resident" || i.kind === "household_member") && !own) ||
        i.acceptancePolicy === "direct_acceptance"
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
              .offset(i.apartmentId ? 0 : (page - 1) * invitationPageSize)
          : [];
      const staffBuildingName = i.staffBuildingId
        ? (await buildingInProject(tx, i.projectId, i.staffBuildingId)).name
        : null;
      return {
        projectName: p.name,
        projectId: p.id,
        staff: combinedStaffDisplay({ ...i, staffBuildingName }),
        acceptancePolicy: i.acceptancePolicy,
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
export async function submitJoin(
  db: Database,
  userId: string,
  token: string,
  value: JoinInput,
): Promise<JoinResult> {
  const input = joinInput.parse(value);
  return db.transaction(async (tx) => {
    const i = await byToken(tx, token, true);
    const staff = combinedStaff(i);
    const direct = i.acceptancePolicy === "direct_acceptance";
    await recipient(tx, i, userId, direct);
    const [own] = await tx
      .select({ id: s.joinRequests.id, status: s.joinRequests.status })
      .from(s.joinRequests)
      .where(and(eq(s.joinRequests.invitationId, i.id), eq(s.joinRequests.userId, userId)));
    if (own) return { id: own.id, status: status(own.status), staff };
    if (!live(i) || i.consumedAt) throw missing();
    const issuerScope = await issuer(tx, i, true);
    if (direct && i.createdBy === userId && !issuerScope?.admin)
      throw new InvitationError(403, "SELF_REVIEW");
    if (i.kind === "household_member") {
      if (i.createdBy === userId) throw new InvitationError(403, "SELF_INVITE");
      if (!("fullName" in input) || "apartmentId" in input)
        throw new InvitationError(400, "INVALID_INPUT");
    } else if (i.kind === "resident") {
      if (!("apartmentId" in input)) throw new InvitationError(400, "INVALID_INPUT");
      if (direct) {
        await provisionResident(tx, i, { ...input, userId }, i.createdBy);
        if (staff) {
          // The recipient row is already locked. Independent role changes serialize with acceptance.
          const coverage = await staffRoleStatus(
            tx,
            userId,
            i.projectId,
            staff.role,
            i.staffBuildingId,
          );
          if (coverage !== "assigned") {
            const granted = await grantStaffRole(
              tx,
              userId,
              i.projectId,
              staff.role,
              i.staffBuildingId,
            );
            if (!granted) throw new InvitationError(409, "STAFF_GRANT_FAILED");
          }
        }
      } else {
        await apartment(tx, i, input.apartmentId);
      }
    } else {
      if ("fullName" in input) throw new InvitationError(400, "INVALID_INPUT");
      await tx
        .select({ id: s.appUsers.id })
        .from(s.appUsers)
        .where(eq(s.appUsers.id, userId))
        .for("update");
      if ((await staffRoleStatus(tx, userId, i.projectId, i.kind, i.buildingId)) === "assigned")
        throw new InvitationError(409, "ALREADY_ASSIGNED");
    }
    const acceptedAt = direct ? new Date() : null;
    const resultStatus = direct ? "approved" : "pending";
    const [row] = await tx
      .insert(s.joinRequests)
      .values({
        invitationId: i.id,
        userId,
        apartmentId:
          i.kind === "household_member"
            ? i.apartmentId
            : "apartmentId" in input
              ? input.apartmentId
              : null,
        fullName: "fullName" in input ? input.fullName : null,
        householdName: "householdName" in input ? input.householdName : null,
        status: resultStatus,
        acceptedAt,
        authorizedBy: direct ? i.createdBy : null,
      })
      .returning({ id: s.joinRequests.id });
    if (!reusable(i))
      await tx
        .update(s.invitations)
        .set({
          consumedAt: acceptedAt ?? new Date(),
          recipientUserId: direct ? userId : i.recipientUserId,
        })
        .where(eq(s.invitations.id, i.id));
    return { ...row, status: resultStatus, staff };
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
          acceptancePolicy: s.invitations.acceptancePolicy,
          staffRole: s.invitations.staffRole,
          staffBuildingId: s.invitations.staffBuildingId,
          staffBuildingName: staffBuilding.name,
        })
        .from(s.joinRequests)
        .innerJoin(s.invitations, eq(s.invitations.id, s.joinRequests.invitationId))
        .innerJoin(s.projects, eq(s.projects.id, s.invitations.projectId))
        .innerJoin(s.appUsers, eq(s.appUsers.id, s.joinRequests.userId))
        .leftJoin(s.buildings, eq(s.buildings.id, s.invitations.buildingId))
        .leftJoin(staffBuilding, eq(staffBuilding.id, s.invitations.staffBuildingId))
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
          staff: combinedStaffDisplay(r),
          projectName: r.projectName,
          buildingName: r.buildingName,
          apartmentNumber: r.apartmentNumber,
          fullName: r.fullName,
          householdName: r.householdName,
          status: status(r.status),
          accountName: r.accountName,
          accountEmail: r.accountEmail,
          canReview:
            !!projectId &&
            r.acceptancePolicy === "manual_review" &&
            (r.userId !== userId || (scope?.admin === true && r.kind !== "household_member")),
          invitationActive: r.issuerActive && !r.revokedAt && r.expiresAt.getTime() > Date.now(),
        })),
        page,
        hasNext: rows.length > invitationPageSize && page < MAX_DIRECTORY_PAGE,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
async function approvedPerson(tx: Tx, userId: string, fullName: string, reviewer: string) {
  const [link] = await tx
    .select({ personId: s.userPersonLinks.personId })
    .from(s.userPersonLinks)
    .where(eq(s.userPersonLinks.userId, userId))
    .for("share");
  let personId = link?.personId;
  if (personId) {
    const [person] = await tx
      .select({ child: s.people.isChild })
      .from(s.people)
      .where(eq(s.people.partyId, personId))
      .for("share");
    if (!person || person.child) throw new InvitationError(409, "IDENTITY_UNAVAILABLE");
  } else {
    const [party] = await tx
      .insert(s.parties)
      .values({ kind: "person" })
      .returning({ id: s.parties.id });
    personId = party.id;
    await tx.insert(s.people).values({ partyId: personId, fullName: fullName, isChild: false });
    await tx.insert(s.userPersonLinks).values({ userId: userId, personId, verifiedBy: reviewer });
  }

  return personId;
}
// Callers hold the applicant row lock so concurrent invitations reuse the same identity.
async function provisionResident(
  tx: Tx,
  i: Invite,
  applicant: { userId: string; apartmentId: string; fullName: string; householdName: string },
  authorizedBy: string,
) {
  const unit = await apartment(tx, i, applicant.apartmentId, true);
  if (i.acceptancePolicy === "direct_acceptance" && (unit.type !== "residential" || !live(i)))
    throw missing();
  const [home] = await tx
    .insert(s.households)
    .values({
      apartmentId: applicant.apartmentId,
      displayName: applicant.householdName,
      approvalStatus: "approved",
      isActive: true,
      createdBy: applicant.userId,
    })
    .onConflictDoNothing({ target: s.households.apartmentId, where: sql`is_active` })
    .returning({ id: s.households.id });
  if (!home) throw new InvitationError(409, "APARTMENT_OCCUPIED");
  const personId = await approvedPerson(tx, applicant.userId, applicant.fullName, authorizedBy);
  await tx
    .insert(s.householdMembers)
    .values({ householdId: home.id, personId, isContactPerson: true });
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
    if (request.userId === reviewer && (!scope.admin || i.kind === "household_member"))
      throw new InvitationError(403, "SELF_REVIEW");
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
        await provisionResident(
          tx,
          i,
          {
            userId: request.userId,
            apartmentId: request.apartmentId,
            fullName: request.fullName!,
            householdName: request.householdName!,
          },
          reviewer,
        );
      } else if (i.kind === "household_member") {
        if (!i.householdId || !request.apartmentId || request.apartmentId !== i.apartmentId)
          throw missing();
        const personId = await approvedPerson(tx, request.userId, request.fullName!, reviewer);
        const [home] = await tx
          .select({ id: s.households.id })
          .from(s.households)
          .where(
            and(
              eq(s.households.id, i.householdId),
              eq(s.households.apartmentId, i.apartmentId!),
              eq(s.households.isActive, true),
              eq(s.households.approvalStatus, "approved"),
            ),
          )
          .for("update");
        if (!home) throw new InvitationError(409, "INVITATION_INACTIVE");
        const [existing] = await tx
          .select({ id: s.householdMembers.id })
          .from(s.householdMembers)
          .where(
            and(
              eq(s.householdMembers.householdId, home.id),
              eq(s.householdMembers.personId, personId),
            ),
          );
        if (!existing) {
          const [count] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(s.householdMembers)
            .where(eq(s.householdMembers.householdId, home.id));
          if (count.n >= MAX_FAMILY_MEMBERS) throw new InvitationError(409, "FAMILY_LIMIT");
          await tx
            .insert(s.householdMembers)
            .values({ householdId: home.id, personId, isContactPerson: false });
        }
      } else {
        if (!scope.admin) throw missing();
        if (
          (await staffRoleStatus(tx, request.userId, projectId, i.kind, i.buildingId)) ===
          "assigned"
        )
          throw new InvitationError(409, "ALREADY_ASSIGNED");
        await grantStaffRole(
          tx,
          request.userId,
          projectId,
          i.kind === "project_manager" ? "project_manager" : "building_manager",
          i.buildingId,
        );
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

async function checkStaffRecipient(
  tx: Tx,
  email: string | null,
  projectId: string,
  role: string,
  buildingId: string | null,
  boundUserId?: string | null,
) {
  if (!email) throw new InvitationError(400, "INVITE_EMAIL_REQUIRED");
  const users = await tx
    .select({ id: s.appUsers.id })
    .from(s.appUsers)
    .where(
      boundUserId ? eq(s.appUsers.id, boundUserId) : sql`lower(${s.appUsers.email}) = ${email}`,
    )
    .limit(2)
    .for("update");
  if (users.length > 1) throw new InvitationError(409, "IDENTITY_UNAVAILABLE");
  if (
    users.length &&
    (await staffRoleStatus(tx, users[0].id, projectId, role, buildingId)) === "assigned"
  )
    throw new InvitationError(409, "ALREADY_ASSIGNED");
}

/** Rotate the bearer secret; pending requests remain attached to the same invitation. */
export async function renewInvitation(db: Database, userId: string, projectId: string, id: string) {
  return db.transaction(async (tx) => {
    const scope = await actorScope(tx, userId, projectId, true);
    const [i] = await tx
      .select()
      .from(s.invitations)
      .where(
        and(eq(s.invitations.id, id), eq(s.invitations.projectId, projectId), scopeWhere(scope)),
      )
      .for("update");
    if (!i || i.kind === "household_member" || !permitted(scope, i)) throw missing();
    return rotateInvitation(tx, userId, i);
  });
}

/** The caller must lock the invitation and authorize its exact scope first. */
export async function rotateInvitation(tx: Tx, userId: string, i: Invite) {
  const completed = await tx
    .select({ id: s.joinRequests.id })
    .from(s.joinRequests)
    .where(
      and(
        eq(s.joinRequests.invitationId, i.id),
        inArray(s.joinRequests.status, ["approved", "rejected"]),
      ),
    )
    .limit(1);
  if (completed.length && !reusable(i)) throw new InvitationError(409, "REQUEST_REVIEWED");
  if (i.kind === "project_manager" || i.kind === "building_manager")
    await checkStaffRecipient(
      tx,
      i.recipientEmail,
      i.projectId,
      i.kind,
      i.buildingId,
      i.recipientUserId,
    );
  const token = randomBytes(32).toString("hex");
  await tx
    .update(s.invitations)
    .set({
      tokenHash: hashInvitationToken(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      revokedAt: null,
      createdBy: userId,
    })
    .where(eq(s.invitations.id, i.id));
  return { id: i.id, token };
}
