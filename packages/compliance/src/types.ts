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
  /** Regular weekly times the person has said they cannot work, e.g. caring, study or another job. */
  unavailable?: Unavailable[];
  /** Adjustments agreed with the person, e.g. because of a disability or neurodivergence. */
  adjustments?: Adjustments;
  /** Ids of the job roles the person is set up to work, e.g. Chef or Senior carer. */
  roles?: string[] | undefined;
}

/** A weekly time someone cannot work, in UK time. weekday: 1 = Monday to 7 = Sunday. to may be "24:00". */
export interface Unavailable {
  weekday: number;
  from: string;
  to: string;
}

/** Shift patterns agreed with the person. Times are UK wall-clock "HH:MM". */
export interface Adjustments {
  maxShiftHours?: number;
  earliestStart?: string;
  latestFinish?: string;
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
  /** The job role the shift is for, if the business uses roles. */
  role?: { id: string; name: string } | undefined;
  /** Care visits: minutes travelling from the previous visit. Travel between visits is working time for the minimum wage. */
  travelMinutesBefore?: number;
  /**
   * Care: a sleep-in, where the person sleeps at work and is woken only if needed. Only the time awake working
   * is paid by the hour and counts for the minimum wage; the rest is paid as the business's sleep-in payment.
   * The whole sleep-in is still working time for rest breaks and the 48-hour week.
   */
  sleepIn?: { awakeMinutes: number } | undefined;
  /** The workplace, when the business has more than one. */
  locationId?: string | null | undefined;
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
  /**
   * Shown to managers only. Staff asking to pick up or swap a shift get a general message instead, so a
   * private arrangement (such as keeping two people apart) is never revealed to them.
   */
  confidential?: boolean;
}

export type LeaveKind =
  | "annual"
  | "sick"
  | "family"
  | "unpaid"
  | "compassionate"
  | "other"
  | "maternity"
  | "paternity"
  | "adoption"
  | "shared_parental"
  | "neonatal"
  | "parental"
  | "parental_bereavement"
  | "carers"
  | "dependants";
export type LeaveStatus = "requested" | "approved";

/** Time off, whole days from startsOn to endsOn inclusive (UK dates). */
export interface Leave {
  workerId: string;
  kind: LeaveKind;
  status: LeaveStatus;
  startsOn: LocalDate;
  endsOn: LocalDate;
  /** Days agreed to work during the leave, such as keeping in touch days. Shifts on these days are fine. */
  workDays?: LocalDate[];
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
  /** Pairs of people a manager has decided must not work at the same time and place. */
  keepApart?: { workerIds: [string, string] }[];
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
