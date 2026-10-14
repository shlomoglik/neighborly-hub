import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const appUsers = pgTable("app_users", {
  id: id(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: createdAt(),
});

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  city: text("city"),
  directoryVisibility: text("directory_visibility").notNull().default("community"),
  createdAt: createdAt(),
}, (t) => [
  check("projects_visibility_check", sql`${t.directoryVisibility} IN ('community', 'building')`),
]);

export const buildings = pgTable("buildings", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
}, (t) => [
  unique("buildings_project_id_name_unique").on(t.projectId, t.name),
  unique("buildings_id_project_id_unique").on(t.id, t.projectId),
  index("buildings_project_id_idx").on(t.projectId),
]);

export const floors = pgTable("floors", {
  id: id(),
  buildingId: uuid("building_id").notNull().references(() => buildings.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
}, (t) => [
  unique("floors_building_id_number_unique").on(t.buildingId, t.number),
  unique("floors_id_building_id_unique").on(t.id, t.buildingId),
  index("floors_building_id_idx").on(t.buildingId),
]);

export const apartments = pgTable("apartments", {
  id: id(),
  buildingId: uuid("building_id").notNull(),
  floorId: uuid("floor_id").notNull(),
  number: text("number").notNull(),
}, (t) => [
  // The matching composite foreign key is defined in the SQL baseline.
  unique("apartments_building_id_number_unique").on(t.buildingId, t.number),
  index("apartments_floor_id_idx").on(t.floorId),
  check("apartments_number_check", sql`length(trim(${t.number})) > 0`),
]);

export const parties = pgTable("parties", {
  id: id(),
  kind: text("kind").notNull(),
  createdAt: createdAt(),
}, (t) => [check("parties_kind_check", sql`${t.kind} IN ('person', 'organization')`)]);

export const people = pgTable("people", {
  partyId: uuid("party_id").primaryKey().references(() => parties.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  birthDate: date("birth_date"),
  isChild: boolean("is_child").notNull().default(false),
});

export const organizations = pgTable("organizations", {
  partyId: uuid("party_id").primaryKey().references(() => parties.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  organizationKind: text("organization_kind").notNull().default("other"),
  registrationNumber: text("registration_number"),
  registrationCountry: text("registration_country"),
}, (t) => [
  check("organizations_kind_check", sql`${t.organizationKind} IN ('company', 'developer', 'municipality', 'nonprofit', 'other')`),
  uniqueIndex("organizations_registration_unique").on(t.registrationCountry, t.registrationNumber)
    .where(sql`${t.registrationCountry} IS NOT NULL AND ${t.registrationNumber} IS NOT NULL`),
]);

export const households = pgTable("households", {
  id: id(),
  apartmentId: uuid("apartment_id").notNull().references(() => apartments.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  approvalStatus: text("approval_status").notNull().default("pending"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => appUsers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex("households_one_active_per_apartment").on(t.apartmentId).where(sql`${t.isActive}`),
  index("households_apartment_id_idx").on(t.apartmentId),
  check("households_approval_status_check", sql`${t.approvalStatus} IN ('pending', 'approved', 'rejected')`),
]);

export const householdMembers = pgTable("household_members", {
  id: id(),
  householdId: uuid("household_id").notNull().references(() => households.id, { onDelete: "cascade" }),
  personId: uuid("person_id").notNull().references(() => people.partyId, { onDelete: "cascade" }),
  relation: text("relation"),
  isContactPerson: boolean("is_contact_person").notNull().default(false),
  contactPriority: integer("contact_priority"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  unique("household_members_household_id_person_id_unique").on(t.householdId, t.personId),
  index("household_members_person_id_idx").on(t.personId),
  check("household_members_contact_priority_check", sql`${t.contactPriority} IS NULL OR ${t.contactPriority} >= 0`),
]);

export const apartmentOwnerships = pgTable("apartment_ownerships", {
  id: id(),
  apartmentId: uuid("apartment_id").notNull().references(() => apartments.id, { onDelete: "cascade" }),
  ownerPartyId: uuid("owner_party_id").notNull().references(() => parties.id, { onDelete: "restrict" }),
  ownershipShare: numeric("ownership_share", { precision: 5, scale: 4 }),
}, (t) => [
  unique("apartment_ownerships_apartment_id_owner_party_id_unique").on(t.apartmentId, t.ownerPartyId),
  index("apartment_ownerships_owner_idx").on(t.ownerPartyId),
  check("apartment_ownerships_share_check", sql`${t.ownershipShare} > 0 AND ${t.ownershipShare} <= 1`),
]);

export const contactMethods = pgTable("contact_methods", {
  id: id(),
  partyId: uuid("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  label: text("label"),
  visibility: text("visibility").notNull().default("managers"),
}, (t) => [
  index("contact_methods_party_id_idx").on(t.partyId),
  check("contact_methods_kind_check", sql`${t.kind} IN ('phone', 'email')`),
  check("contact_methods_value_check", sql`length(trim(${t.value})) > 0`),
  check("contact_methods_visibility_check", sql`${t.visibility} IN ('project', 'building', 'managers')`),
]);

export const organizationContacts = pgTable("organization_contacts", {
  id: id(),
  organizationPartyId: uuid("organization_party_id").notNull().references(() => organizations.partyId, { onDelete: "cascade" }),
  personPartyId: uuid("person_party_id").notNull().references(() => people.partyId, { onDelete: "cascade" }),
  roleLabel: text("role_label"),
  isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
}, (t) => [
  unique("organization_contacts_organization_party_id_person_party_id_unique").on(t.organizationPartyId, t.personPartyId),
  index("organization_contacts_person_idx").on(t.personPartyId),
]);

export const staffAssignments = pgTable("staff_assignments", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  buildingId: uuid("building_id"),
  role: text("role").notNull(),
}, (t) => [
  index("staff_assignments_user_idx").on(t.userId),
  check("staff_assignments_role_check", sql`${t.role} IN ('project_manager', 'building_manager')`),
  check("staff_assignments_scope_check", sql`(${t.role} = 'project_manager' AND ${t.buildingId} IS NULL) OR (${t.role} = 'building_manager' AND ${t.buildingId} IS NOT NULL)`),
  // The composite building/project FK and NULLS NOT DISTINCT uniqueness are SQL-baseline constraints.
]);

export const globalRoles = pgTable("global_roles", {
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.role] }),
  check("global_roles_role_check", sql`${t.role} IN ('admin')`),
]);
