// Business data. Every table carries organisation_id and is protected by row-level security
// (see migrations/0001_row_level_security.sql), so one business can never read another's data.
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  doublePrecision,
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
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const sector = pgEnum("sector", ["care", "hospitality", "small_business"]);
export const role = pgEnum("role", ["owner", "manager", "worker"]);
export const shiftStatus = pgEnum("shift_status", ["draft", "published", "cancelled"]);
export const checkKind = pgEnum("check_kind", ["right_to_work", "dbs"]);
export const leaveKind = pgEnum("leave_kind", ["annual", "sick", "family", "unpaid", "compassionate", "other"]);
export const leaveStatus = pgEnum("leave_status", ["requested", "approved", "declined", "cancelled"]);
export const tipSource = pgEnum("tip_source", ["card", "cash", "service_charge"]);
export const tipMethod = pgEnum("tip_method", ["hours", "equal"]);
export const claimStatus = pgEnum("claim_status", ["requested", "approved", "declined", "withdrawn"]);
export const concernCategory = pgEnum("concern_category", ["abuse_or_neglect", "self_harm", "colleague_conduct", "health_and_safety", "other"]);
export const concernStatus = pgEnum("concern_status", ["open", "in_progress", "referred", "closed"]);
export const concernActionKind = pgEnum("concern_action_kind", ["note", "referral", "status"]);
export const loneCheckKind = pgEnum("lone_check_kind", ["start", "ok", "finished", "help", "resolved"]);
export const noticeKind = pgEnum("notice_kind", ["added", "changed", "cancelled", "given_to_you", "taken_by_colleague"]);
export const clockKind = pgEnum("clock_kind", ["in", "break_start", "break_end", "out"]);
export const clockLocationRule = pgEnum("clock_location_rule", ["off", "record", "require"]);
export const clockSource = pgEnum("clock_source", ["phone", "kiosk"]);
export const clockPlace = pgEnum("clock_place", ["at_work", "away", "unknown"]);
export const dbsLevel = pgEnum("dbs_level", ["basic", "standard", "enhanced", "enhanced_barred"]);

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const orgId = () =>
  uuid("organisation_id")
    .notNull()
    .references(() => organisation.id, { onDelete: "cascade" });

export const CONTACT_WAYS = ["text", "app", "call", "in_person"] as const;
export type ContactWay = (typeof CONTACT_WAYS)[number];

export type WorkProfile = {
  strengths?: string;
  helps?: string;
  changes?: string;
  hardDay?: string;
  /** Ways they are happy to be contacted about work, best first. */
  contact?: ContactWay[];
  /** Phone calls only if it is urgent. */
  avoidCalls?: boolean;
  /** Whether managers can see this. Off until the person turns it on. */
  shared?: boolean;
};

export const organisation = pgTable("organisation", {
  id: id(),
  name: text("name").notNull(),
  sector: sector("sector").notNull(),
  /** Care providers: every shift needs an enhanced DBS with barred list check. */
  requiresEnhancedDbs: boolean("requires_enhanced_dbs").notNull().default(false),
  /** Month the holiday year starts, 1 = January. */
  leaveYearStartMonth: smallint("leave_year_start_month").notNull().default(1),
  /** Care: travel between visits is paid at the hourly rate. */
  paysTravelTime: boolean("pays_travel_time").notNull().default(false),
  /** Written tipping policy that staff can read (Employment (Allocation of Tips) Act 2023). */
  tippingPolicy: text("tipping_policy"),
  /** Whether phone clock-ins check the person is at a workplace: not at all, noted for the manager, or required. */
  clockLocationRule: clockLocationRule("clock_location_rule").notNull().default("off"),
  /** Text the alert contacts when nobody has clocked in this many minutes after a shift starts. Null is off. */
  lateAlertMinutes: smallint("late_alert_minutes"),
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
  /** Where the workplace is, for checking that phone clock-ins happen at work. */
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  radiusMetres: integer("radius_metres").notNull().default(150),
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
    /** Hashed PIN for clocking in on an in-store tablet. */
    pinHash: text("pin_hash"),
    pinFailures: smallint("pin_failures").notNull().default(0),
    pinLockedUntil: timestamp("pin_locked_until", { withTimezone: true }),
    /** UK mobile in E.164 form, for texting an invitation and, if they ask, rota changes. */
    mobile: text("mobile"),
    /**
     * Adjustments agreed with the person, checked on every rota (Equality Act 2010, s. 20).
     * note says why in their own words and is shown only to them and managers, never on the rota.
     */
    adjustments: jsonb("adjustments").$type<{ maxShiftHours?: number; earliestStart?: string; latestFinish?: string; note?: string }>().notNull().default({}),
    /**
     * "How I work best", written by the person in their own words. Managers see it only while shared
     * is true; it is never shown on the rota, in warnings or in the audit trail.
     */
    workProfile: jsonb("work_profile").$type<WorkProfile>().notNull().default({}),
    /** How the person likes their own pages shown (calm mode, larger text), and which texts they asked for (rota changes, shift reminders). */
    preferences: jsonb("preferences")
      .$type<{ calm?: boolean; largeText?: boolean; textChanges?: boolean; remindEvening?: boolean; remindBeforeMinutes?: number | null }>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("worker_org_idx").on(t.organisationId),
    // A login is linked to at most one staff record per business.
    uniqueIndex("worker_org_user_idx").on(t.organisationId, t.userId),
  ],
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
    /** Care: the person this visit is for. */
    clientId: uuid("client_id").references(() => client.id, { onDelete: "set null" }),
    /** Care: minutes travelling from the previous visit. */
    travelMinutes: integer("travel_minutes").notNull().default(0),
    /** The job role the shift is for, e.g. Chef. Optional: small teams may not use roles. */
    roleId: uuid("role_id").references((): AnyPgColumn => jobRole.id, { onDelete: "set null" }),
    /** Set when the person on this shift has asked for someone to cover it. */
    coverRequestedAt: timestamp("cover_requested_at", { withTimezone: true }),
    /** Working alone: the person checks in at the start, every check_in_minutes, and at the end. */
    loneWorking: boolean("lone_working").notNull().default(false),
    checkInMinutes: smallint("check_in_minutes").notNull().default(60),
    /** What to expect, written by the manager for the person on the shift, for example "Delivery at 10". */
    note: text("note"),
    /** Parts of one split shift (for example 07:00 to 10:00 and 16:00 to 19:00) share this id. Each part is clocked separately. */
    splitGroupId: uuid("split_group_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check("shift_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    check("shift_travel_minutes", sql`${t.travelMinutes} between 0 and 240`),
    check("shift_check_in_minutes", sql`${t.checkInMinutes} between 15 and 240`),
    index("shift_org_start_idx").on(t.organisationId, t.startsAt), index("shift_worker_idx").on(t.workerId, t.startsAt),
    index("shift_split_group_idx").on(t.splitGroupId),
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
    /** Sickness only: the day the manager had the fit note, needed for spells over 7 days. */
    fitNoteOn: date("fit_note_on"),
    /**
     * Sickness only: average weekly earnings for Statutory Sick Pay, in pence, entered by the manager.
     * Empty means VicisRota estimates it from confirmed hours in the 8 weeks before.
     */
    sspWeeklyEarningsPence: integer("ssp_weekly_earnings_pence"),
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

/**
 * An invitation for a member of staff to create a login. Like membership, this table has no row-level
 * security: it is looked up by token before the business is known. Only a SHA-256 hash of the token is
 * stored, so a database leak does not reveal working links.
 */
export const invitation = pgTable(
  "invitation",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisation.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("invitation_worker_idx").on(t.workerId)],
);

/**
 * Care: a person who receives visits. Kept deliberately minimal: what carers need to find them and
 * provide safe care. Detailed care plans belong in the care planning system, not the rota.
 */
export const client = pgTable("client", {
  id: id(),
  organisationId: orgId(),
  name: text("name").notNull(),
  postcode: text("postcode"),
  /** Key safe, parking, preferred name: shown only to carers visiting this person. */
  visitNotes: text("visit_notes"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * Tips, gratuities and service charges received by the business. Records are kept for at least three
 * years, so shared tips are never deleted.
 */
export const tip = pgTable(
  "tip",
  {
    id: id(),
    organisationId: orgId(),
    receivedOn: date("received_on").notNull(),
    amountPence: integer("amount_pence").notNull(),
    source: tipSource("source").notNull(),
    note: text("note"),
    /** Set once the tip has been shared out; it can no longer be changed. */
    allocationId: uuid("allocation_id").references(() => tipAllocation.id),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("tip_org_received_idx").on(t.organisationId, t.receivedOn), check("tip_amount_positive", sql`${t.amountPence} > 0`)],
);

/** One sharing-out of a tip pool for a period. */
export const tipAllocation = pgTable("tip_allocation", {
  id: id(),
  organisationId: orgId(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  totalPence: integer("total_pence").notNull(),
  method: tipMethod("method").notNull(),
  /** The legal deadline: the end of the month after the earliest tip in the pool was received. */
  payBy: date("pay_by").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  requestId: text("request_id"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const tipShare = pgTable(
  "tip_share",
  {
    id: id(),
    organisationId: orgId(),
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => tipAllocation.id),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id),
    hours: numeric("hours", { precision: 7, scale: 2, mode: "number" }).notNull(),
    pence: integer("pence").notNull(),
  },
  (t) => [index("tip_share_worker_idx").on(t.workerId)],
);

/** A member of staff asking to take an open shift, or to cover a colleague's shift. A manager decides. */
export const shiftClaim = pgTable(
  "shift_claim",
  {
    id: id(),
    organisationId: orgId(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    status: claimStatus("status").notNull().default("requested"),
    /** Warnings from the compliance check when the claim was made, for the manager to see. */
    warnings: jsonb("warnings").notNull().default([]),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("shift_claim_shift_idx").on(t.shiftId),
    // One open claim per person per shift.
    uniqueIndex("shift_claim_open_idx").on(t.shiftId, t.workerId).where(sql`${t.status} = 'requested'`),
  ],
);

/**
 * A safeguarding or whistleblowing concern. What was reported cannot be edited afterwards (a trigger
 * allows only the status to change), and everything done about it goes in safeguarding_action.
 * When raised anonymously, nothing identifying the person who raised it is stored.
 */
export const safeguardingConcern = pgTable(
  "safeguarding_concern",
  {
    id: id(),
    organisationId: orgId(),
    raisedByUserId: text("raised_by_user_id").references(() => user.id, { onDelete: "set null" }),
    raisedByName: text("raised_by_name"),
    category: concernCategory("category").notNull(),
    clientId: uuid("client_id").references(() => client.id, { onDelete: "set null" }),
    /** Who the concern is about, when it is not one of the business's clients. */
    aboutPerson: text("about_person"),
    happenedOn: date("happened_on"),
    details: text("details").notNull(),
    immediateDanger: boolean("immediate_danger").notNull().default(false),
    status: concernStatus("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [
    index("safeguarding_concern_status_idx").on(t.organisationId, t.status),
    check("safeguarding_concern_details_present", sql`length(trim(${t.details})) > 0`),
  ],
);

/** Append-only record of what was done about a concern: notes, referrals and status changes. */
export const safeguardingAction = pgTable(
  "safeguarding_action",
  {
    id: id(),
    organisationId: orgId(),
    concernId: uuid("concern_id")
      .notNull()
      .references(() => safeguardingConcern.id),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    kind: concernActionKind("kind").notNull(),
    /** For a referral: who it went to, such as the local authority safeguarding team or CQC. */
    referredTo: text("referred_to"),
    note: text("note").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("safeguarding_action_concern_idx").on(t.concernId)],
);

/** Lone working check-ins, calls for help, and managers marking a call for help as dealt with. Append-only. */
export const loneWorkCheck = pgTable(
  "lone_work_check",
  {
    id: id(),
    organisationId: orgId(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name"),
    kind: loneCheckKind("kind").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("lone_work_check_shift_idx").on(t.shiftId, t.createdAt)],
);

/**
 * Tells a person each time their published rota changes, so nothing moves without them knowing.
 * notice_hours is how much warning they got: the time from the change to the start of the shift.
 */
export const rotaNotice = pgTable(
  "rota_notice",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    kind: noticeKind("kind").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    noticeHours: integer("notice_hours").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("rota_notice_worker_idx").on(t.workerId, t.createdAt)],
);

/** Regular weekly times someone cannot work, in UK time. weekday: 1 = Monday to 7 = Sunday; ends_at may be "24:00". */
export const workerUnavailability = pgTable(
  "worker_unavailability",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("worker_unavailability_worker_idx").on(t.workerId),
    check("worker_unavailability_weekday", sql`${t.weekday} between 1 and 7`),
    check("worker_unavailability_times", sql`${t.startsAt} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' and ${t.endsAt} ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' and ${t.endsAt} > ${t.startsAt}`),
  ],
);

/** People texted when someone working alone asks for help or misses a check-in. They must agree to receive these texts. */
export const alertContact = pgTable("alert_contact", {
  id: id(),
  organisationId: orgId(),
  name: text("name").notNull(),
  /** UK mobile in E.164 form, for example +447700900123. */
  phone: text("phone").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * Every text sent or attempted, so a missing alert can be traced. dedupe_key stops the same alert
 * being sent twice (for example "overdue:<shift>:<due time>").
 */
export const smsMessage = pgTable(
  "sms_message",
  {
    id: id(),
    organisationId: orgId(),
    to: text("to").notNull(),
    purpose: text("purpose").notNull(),
    body: text("body").notNull(),
    provider: text("provider").notNull(),
    ok: boolean("ok").notNull(),
    providerRef: text("provider_ref"),
    error: text("error"),
    dedupeKey: text("dedupe_key"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sms_message_dedupe_idx").on(t.organisationId, t.dedupeKey, t.to)],
);

/** Clock-ins, breaks and clock-outs, at the time the server received them. Append-only. */
export const clockEvent = pgTable(
  "clock_event",
  {
    id: id(),
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id),
    kind: clockKind("kind").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    source: clockSource("source").notNull().default("phone"),
    /** Only the result of a location check is kept: which workplace was nearest and how far away, never the coordinates. */
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    place: clockPlace("place"),
    distanceMetres: integer("distance_metres"),
  },
  (t) => [index("clock_event_shift_idx").on(t.shiftId, t.at)],
);

/**
 * A tablet or computer set up at a workplace for staff to clock in with their PIN. Found by its
 * token (stored hashed) before the business is known, so like invitations it has no row-level security.
 */
export const kioskDevice = pgTable("kiosk_device", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisation.id, { onDelete: "cascade" }),
  locationId: uuid("location_id")
    .notNull()
    .references(() => location.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/**
 * A message from managers to all staff, such as a policy change. The wording cannot be changed once
 * posted (enforced in the database), so a confirmation always refers to what the person actually read.
 */
export const announcement = pgTable(
  "announcement",
  {
    id: id(),
    organisationId: orgId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Staff are asked to confirm they have read it, and managers see who has not. */
    needsConfirmation: boolean("needs_confirmation").notNull().default(false),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("announcement_org_idx").on(t.organisationId, t.createdAt)],
);

/** When each person read or confirmed an announcement. Append-only. */
export const announcementRead = pgTable(
  "announcement_read",
  {
    id: id(),
    organisationId: orgId(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcement.id, { onDelete: "cascade" }),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("announcement_read_once_idx").on(t.announcementId, t.workerId)],
);

/**
 * VicisRota's own staff who can use the superadmin area (/admin). Platform-wide, so no row-level security.
 * Added only from the command line (`npm run add-superadmin -w @vicisrota/db -- <email>`), never from the app,
 * so nobody can make themselves a superadmin by signing up with an address.
 */
export const platformAdmin = pgTable("platform_admin", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

/**
 * An invitation for a new customer's owner to take over a business a superadmin set up for them.
 * Looked up by token before the person belongs to the business, so no row-level security, like invitation.
 */
export const ownerInvitation = pgTable("owner_invitation", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisation.id, { onDelete: "cascade" }),
  /** Who the business expects, shown on the link page. The link works for whoever opens it, so it must go to them directly. */
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: text("accepted_by_user_id").references(() => user.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** Everything a superadmin does, kept apart from each business's own audit trail. Append-only (trigger). */
export const platformAudit = pgTable(
  "platform_audit",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    organisationId: uuid("organisation_id").references(() => organisation.id, { onDelete: "set null" }),
    data: jsonb("data"),
    createdAt: createdAt(),
  },
  (t) => [index("platform_audit_created_idx").on(t.createdAt)],
);

/** Colours a job role can be shown in. The name is always shown too, so colour is never the only clue. */
export const roleColour = pgEnum("role_colour", ["teal", "blue", "purple", "pink", "orange", "green", "grey"]);

/** Job roles a business uses on its rota, e.g. "Chef" or "Senior carer". */
export const jobRole = pgTable(
  "job_role",
  {
    id: id(),
    organisationId: orgId(),
    name: text("name").notNull(),
    colour: roleColour("colour").notNull().default("teal"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("job_role_org_name_idx").on(t.organisationId, sql`lower(${t.name})`)],
);

/** Which roles each person is set up to work. */
export const workerRole = pgTable(
  "worker_role",
  {
    organisationId: orgId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => worker.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => jobRole.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.workerId, t.roleId] })],
);

/** A regular one-to-four week rota, saved so future weeks can be filled from it. */
export const rotaPattern = pgTable(
  "rota_pattern",
  {
    id: id(),
    organisationId: orgId(),
    name: text("name").notNull(),
    weeks: smallint("weeks").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("rota_pattern_org_name_idx").on(t.organisationId, sql`lower(${t.name})`), check("rota_pattern_weeks", sql`${t.weeks} between 1 and 4`)],
);

/** One shift in a pattern, in UK wall-clock time. A person or role removed later leaves an open shift. */
export const rotaPatternShift = pgTable(
  "rota_pattern_shift",
  {
    id: id(),
    organisationId: orgId(),
    patternId: uuid("pattern_id")
      .notNull()
      .references(() => rotaPattern.id, { onDelete: "cascade" }),
    weekIndex: smallint("week_index").notNull(),
    /** 0 = Monday ... 6 = Sunday. */
    weekday: smallint("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    endsNextDay: boolean("ends_next_day").notNull().default(false),
    workerId: uuid("worker_id").references(() => worker.id, { onDelete: "set null" }),
    roleId: uuid("role_id").references(() => jobRole.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => client.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => location.id, { onDelete: "set null" }),
    note: text("note"),
    travelMinutes: integer("travel_minutes").notNull().default(0),
    loneWorking: boolean("lone_working").notNull().default(false),
    checkInMinutes: smallint("check_in_minutes").notNull().default(60),
    breaks: jsonb("breaks").$type<{ offsetMinutes: number; minutes: number }[]>().notNull().default([]),
    /** Training the shift needs (qualification ids). */
    requires: jsonb("requires").$type<string[]>().notNull().default([]),
  },
  (t) => [
    index("rota_pattern_shift_pattern_idx").on(t.patternId),
    check("rota_pattern_shift_week", sql`${t.weekIndex} between 0 and 3 and ${t.weekday} between 0 and 6`),
  ],
);

export const supportStatus = pgEnum("support_status", ["new", "triaged", "replied", "closed"]);

/** What the support assistant suggests for a report. A suggestion only: a VicisRota person decides and replies. */
export type SupportTriage = {
  summary: string;
  likelyCause: string;
  area: string;
  urgency: "low" | "normal" | "high" | "urgent";
  /** True when the report sounds like someone may be at risk, so it is pointed to safeguarding, not support. */
  possibleSafeguarding: boolean;
  nextSteps: string[];
  suggestedReply: string;
  model: string;
};

/**
 * A problem reported to VicisRota by a manager or member of staff. Platform-level, like platform_audit:
 * reporters only ever see their own reports (filtered by user in code) and superadmins see them all.
 */
export const supportReport = pgTable(
  "support_report",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisation.id, { onDelete: "set null" }),
    reporterUserId: text("reporter_user_id").references(() => user.id, { onDelete: "set null" }),
    /** "manager" or "worker", so replies can be pitched right. */
    reporterRole: text("reporter_role").notNull(),
    /** The page they were on, e.g. /rota. */
    page: text("page"),
    /** The reference shown on an error page, which matches the server log. */
    errorRef: text("error_ref"),
    what: text("what").notNull(),
    status: supportStatus("status").notNull().default("new"),
    triage: jsonb("triage").$type<SupportTriage>(),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("support_report_created_idx").on(t.createdAt), index("support_report_reporter_idx").on(t.reporterUserId)],
);
