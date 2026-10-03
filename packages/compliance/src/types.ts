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

export interface Context {
  /** The date the rota is being checked on; selects which rule versions apply. */
  asOf: LocalDate;
  workers: Worker[];
  /** All shifts for the period under check, plus enough history for averaging. */
  shifts: Shift[];
  payRates?: PayRate[];
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
