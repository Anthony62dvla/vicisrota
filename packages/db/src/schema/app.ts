// Business data. Every table carries organisation_id and is protected by row-level security
// (see migrations/0001_row_level_security.sql), so one business can never read another's data.
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const sector = pgEnum("sector", ["care", "hospitality", "small_business"]);
export const role = pgEnum("role", ["owner", "manager", "worker"]);
export const shiftStatus = pgEnum("shift_status", ["draft", "published", "cancelled"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const orgId = () =>
  uuid("organisation_id")
    .notNull()
    .references(() => organisation.id, { onDelete: "cascade" });

export const organisation = pgTable("organisation", {
  id: id(),
  name: text("name").notNull(),
  sector: sector("sector").notNull(),
  createdAt: createdAt(),
});

/** Who can sign in to which business, and with what role. */
export const membership = pgTable(
  "membership",
  {
    organisationId: orgId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: role("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.organisationId, t.userId] }), index("membership_user_idx").on(t.userId)],
);

export const location = pgTable("location", {
  id: id(),
  organisationId: orgId(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: createdAt(),
});

export const worker = pgTable(
  "worker",
  {
    id: id(),
    organisationId: orgId(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    dateOfBirth: date("date_of_birth").notNull(),
    employmentStart: date("employment_start"),
    optedOutOf48HourLimit: boolean("opted_out_of_48_hour_limit").notNull().default(false),
    apprenticeRateApplies: boolean("apprentice_rate_applies").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("worker_org_idx").on(t.organisationId)],
);

export const payRate = pgTable(
  "pay_rate",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    hourlyPence: integer("hourly_pence").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("pay_rate_worker_idx").on(t.workerId, t.effectiveFrom)],
);

export const shift = pgTable(
  "shift",
  {
    id: id(),
    organisationId: orgId(),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    /** Null for an open shift that nobody has claimed yet. */
    workerId: uuid("worker_id").references(() => worker.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: shiftStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("shift_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    index("shift_org_start_idx").on(t.organisationId, t.startsAt), index("shift_worker_idx").on(t.workerId, t.startsAt),
  ],
);

export const shiftBreak = pgTable("shift_break", {
  id: id(),
  organisationId: orgId(),
  shiftId: uuid("shift_id")
    .notNull()
    .references(() => shift.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
});

/** Every compliance check, with the rule versions used, so any decision can be explained later. */
export const complianceDecision = pgTable(
  "compliance_decision",
  {
    id: id(),
    organisationId: orgId(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    asOf: date("as_of").notNull(),
    rulesApplied: jsonb("rules_applied").notNull(),
    findings: jsonb("findings").notNull(),
    publishable: boolean("publishable").notNull(),
    requestId: text("request_id"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("compliance_decision_org_idx").on(t.organisationId, t.checkedAt)],
);

/** A manager's recorded reason for going ahead despite a warning. */
export const complianceOverride = pgTable("compliance_override", {
  id: id(),
  organisationId: orgId(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => complianceDecision.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").notNull(),
  shiftIds: jsonb("shift_ids").notNull(),
  reason: text("reason").notNull(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Append-only history of every change. Updates and deletes are refused by a database trigger. */
export const auditEvent = pgTable(
  "audit_event",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // No cascade: a business with history cannot be deleted by accident.
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisation.id),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: text("actor_user_id"),
    requestId: text("request_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
  },
  (t) => [index("audit_event_org_idx").on(t.organisationId, t.at)],
);
