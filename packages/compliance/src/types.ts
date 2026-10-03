/** ISO 8601 instant with offset, e.g. "2026-10-05T09:00:00+01:00". */
export type Instant = string;
/** Calendar date, e.g. "2008-03-14". */
export type LocalDate = string;

export interface Worker {
  id: string;
  name: string;
  dateOfBirth: LocalDate;
  /** Signed, unrevoked opt-out from the 48-hour weekly average (WTR reg 5). */
  optedOutOf48HourLimit?: boolean;
  /** Apprentice in the first year, or under 19 (NMW apprentice rate). */
  apprenticeRateApplies?: boolean;
  /** Right to work and DBS checks on file. */
  checks?: Check[];
  /** Training and qualifications held. */
  qualifications?: Qualification[];
}

export type CheckKind = "right_to_work" | "dbs";
/** enhanced_barred = enhanced DBS with a children's and/or adults' barred list check. */
export type DbsLevel = "basic" | "standard" | "enhanced" | "enhanced_barred";

export interface Check {
  kind: CheckKind;
  checkedOn: LocalDate;
  /** For time-limited permission to work, the date a follow-up check is due. */
  expiresOn?: LocalDate;
  dbsLevel?: DbsLevel;
}

export interface Qualification {
  id: string;
  name: string;
  achievedOn?: LocalDate;
  expiresOn?: LocalDate;
}

export interface Break {
  start: Instant;
  end: Instant;
}

export interface Shift {
  id: string;
  workerId: string;
  start: Instant;
  end: Instant;
  breaks?: Break[];
  /** Training the person on this shift must hold, e.g. medication competency. */
  requiredQualifications?: { id: string; name: string }[];
  /** Care visits: minutes travelling from the previous visit. Travel between visits is working time for the minimum wage. */
  travelMinutesBefore?: number;
}

export interface PayRate {
  workerId: string;
  /** Pence per hour, to avoid floating point money. */
  hourlyPence: number;
  effectiveFrom: LocalDate;
}

/**
 * block: the rota cannot be published.
 * warn: the manager must give a reason, which is logged.
 */
export type Severity = "block" | "warn";

export interface Finding {
  ruleId: string;
  ruleVersion: number;
  severity: Severity;
  workerId: string;
  shiftIds: string[];
  /** Plain-English explanation shown to managers and workers. */
  message: string;
  /** The numbers behind the decision, kept in the audit log. */
  evidence: Record<string, number | string | boolean>;
  legalRef: string;
}

export type LeaveKind = "annual" | "sick" | "family" | "unpaid" | "compassionate" | "other";
export type LeaveStatus = "requested" | "approved";

/** Time off, whole days from startsOn to endsOn inclusive (UK dates). */
export interface Leave {
  workerId: string;
  kind: LeaveKind;
  status: LeaveStatus;
  startsOn: LocalDate;
  endsOn: LocalDate;
}

export interface Context {
  /** The date the rota is being checked on; selects which rule versions apply. */
  asOf: LocalDate;
  workers: Worker[];
  /** All shifts for the period under check, plus enough history for averaging. */
  shifts: Shift[];
  payRates?: PayRate[];
  /** Approved and requested leave. Declined and cancelled leave is left out. */
  leave?: Leave[];
  settings?: {
    /** Care providers: every shift is regulated activity needing an enhanced DBS with barred list check. */
    requireEnhancedDbs?: boolean;
    /** Travel between care visits is paid at the hourly rate, so it cannot pull pay below the minimum. */
    paysTravelTime?: boolean;
  };
}

export interface Rule {
  id: string;
  version: number;
  title: string;
  legalRef: string;
  effectiveFrom: LocalDate;
  effectiveTo?: LocalDate;
  check(ctx: Context): Finding[];
}
