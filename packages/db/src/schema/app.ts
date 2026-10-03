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
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const sector = pgEnum("sector", ["care", "hospitality", "small_business"]);
export const role = pgEnum("role", ["owner", "manager", "worker"]);
export const shiftStatus = pgEnum("shift_status", ["draft", "published", "cancelled"]);
export const checkKind = pgEnum("check_kind", ["right_to_work", "dbs"]);
export const leaveKind = pgEnum("leave_kind", ["annual", "sick", "family", "unpaid", "compassionate", "other"]);
export const leaveStatus = pgEnum("leave_status", ["requested", "approved", "declined", "cancelled"]);
export const dbsLevel = pgEnum("dbs_level", ["basic", "standard", "enhanced", "enhanced_barred"]);

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
  /** Care providers: every shift needs an enhanced DBS with barred list check. */
  requiresEnhancedDbs: boolean("requires_enhanced_dbs").notNull().default(false),
  /** Month the holiday year starts, 1 = January. */
  leaveYearStartMonth: smallint("leave_year_start_month").notNull().default(1),
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
    /** Usual working days a week, for statutory leave (5.6 weeks, capped at 28 days). */
    daysPerWeek: numeric("days_per_week", { precision: 3, scale: 1, mode: "number" }).notNull().default(5),
    /** Irregular hours or part-year: leave accrues at 12.07% of hours worked instead. */
    irregularHours: boolean("irregular_hours").notNull().default(false),
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

/** Right to work and DBS checks. The documents themselves are kept elsewhere; this is the record. */
export const workerCheck = pgTable(
  "worker_check",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    kind: checkKind("kind").notNull(),
    checkedOn: date("checked_on").notNull(),
    /** Time-limited permission to work: when a follow-up check is due. */
    expiresOn: date("expires_on"),
    dbsLevel: dbsLevel("dbs_level"),
    /** Share code, DBS certificate number or similar. */
    reference: text("reference"),
    createdAt: createdAt(),
  },
  (t) => [index("worker_check_worker_idx").on(t.workerId)],
);

/** Training and qualifications a business tracks, e.g. "Medication competency". */
export const qualification = pgTable("qualification", {
  id: id(),
  organisationId: orgId(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const workerQualification = pgTable(
  "worker_qualification",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    qualificationId: uuid("qualification_id")
      .notNull()
      .references(() => qualification.id, { onDelete: "cascade" }),
    achievedOn: date("achieved_on"),
    expiresOn: date("expires_on"),
    createdAt: createdAt(),
  },
  (t) => [index("worker_qualification_worker_idx").on(t.workerId)],
);

/** Training the person working a shift must hold. */
export const shiftRequirement = pgTable(
  "shift_requirement",
  {
    organisationId: orgId(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    qualificationId: uuid("qualification_id")
      .notNull()
      .references(() => qualification.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.shiftId, t.qualificationId] })],
);

/** Holiday, sickness and other time off. Days are whole UK dates, startsOn to endsOn inclusive. */
export const leaveRequest = pgTable(
  "leave_request",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    kind: leaveKind("kind").notNull(),
    status: leaveStatus("status").notNull().default("requested"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    /** Working days taken from the holiday balance (annual leave, regular hours). */
    days: numeric("days", { precision: 4, scale: 1, mode: "number" }),
    /** Hours taken from the balance (annual leave, irregular hours). */
    hours: numeric("hours", { precision: 5, scale: 2, mode: "number" }),
    note: text("note"),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("leave_request_worker_idx").on(t.workerId, t.startsOn),
    check("leave_request_dates", sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);

/** Hours actually worked, confirmed by a manager. Pay is calculated from these, not the rota. */
export const timeEntry = pgTable(
  "time_entry",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    /** The rota shift this confirms, if any. One confirmation per shift. */
    shiftId: uuid("shift_id")
      .unique()
      .references(() => shift.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    breakMinutes: integer("break_minutes").notNull().default(0),
    note: text("note"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("time_entry_worker_idx").on(t.workerId, t.startsAt),
    check("time_entry_times", sql`${t.endsAt} > ${t.startsAt}`),
    check("time_entry_break", sql`${t.breakMinutes} >= 0 and ${t.breakMinutes} * interval '1 minute' < ${t.endsAt} - ${t.startsAt}`),
  ],
);

/** A record of each payroll export, so a period sent to payroll is visible and traceable. */
export const payrollExport = pgTable("payroll_export", {
  id: id(),
  organisationId: orgId(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  lineCount: integer("line_count").notNull(),
  totalPence: integer("total_pence").notNull(),
  /** People flagged below minimum wage when exported. */
  flaggedCount: integer("flagged_count").notNull(),
  requestId: text("request_id"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});
