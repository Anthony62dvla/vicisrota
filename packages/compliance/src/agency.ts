import { addDays } from "./time";
import type { LeaveKind, LocalDate } from "./types";

export const AGENCY_LEGAL_REF = "Agency Workers Regulations 2010, regs 5 to 7 (equal treatment after 12 weeks in the same role with the same hirer)";
export const AGENCY_QUALIFYING_WEEKS = 12;
/** A break of more than 6 weeks for an ordinary reason starts the count again. */
const MAX_BREAK_WEEKS = 6;
/** Sickness, holiday and similar breaks pause the count for up to 28 weeks. */
const MAX_PAUSE_WEEKS = 28;

/** Leave during pregnancy, maternity, adoption and paternity counts towards the 12 weeks. */
const COUNTS: LeaveKind[] = ["maternity", "paternity", "adoption", "shared_parental", "neonatal", "family"];
/** Sickness, holiday and other agreed time off pause the count. */
const PAUSES: LeaveKind[] = ["sick", "annual", "compassionate", "parental", "parental_bereavement", "carers", "dependants", "other", "unpaid"];

export interface AgencyProgress {
  /** Qualifying weeks so far, up to and including the week containing asOf. */
  weeks: number;
  /** The first day of the 13th week, when equal treatment starts. Null if not reached yet. */
  qualifiedOn: LocalDate | null;
  /** If not qualified: when they will be, if they work every week from now. */
  expectedOn: LocalDate | null;
  /** The count started again after a long break. */
  restartedOn: LocalDate | null;
}

/**
 * Counts an agency worker's qualifying weeks with this business. A week is the 7 days from the day the assignment
 * started (not Monday to Sunday). Any work in a week makes it count.
 */
export const agencyProgress = (input: {
  startedOn: LocalDate;
  /** Days they worked or are on the rota to work. */
  workedOn: LocalDate[];
  leave: { kind: LeaveKind; startsOn: LocalDate; endsOn: LocalDate }[];
  asOf: LocalDate;
}): AgencyProgress => {
  const worked = new Set(input.workedOn);
  const inWeek = (from: LocalDate, test: (d: LocalDate) => boolean) => Array.from({ length: 7 }, (_, i) => addDays(from, i)).some(test);
  const onLeave = (kinds: LeaveKind[]) => (d: LocalDate) => input.leave.some((l) => kinds.includes(l.kind) && l.startsOn <= d && l.endsOn >= d);

  let weeks = 0;
  let gap = 0;
  let paused = 0;
  let qualifiedOn: LocalDate | null = null;
  let restartedOn: LocalDate | null = null;
  let week = input.startedOn;
  for (; week <= input.asOf; week = addDays(week, 7)) {
    if (inWeek(week, (d) => worked.has(d) || onLeave(COUNTS)(d))) {
      if (gap > MAX_BREAK_WEEKS || paused > MAX_PAUSE_WEEKS) {
        weeks = 0;
        qualifiedOn = null;
        restartedOn = week;
      }
      gap = 0;
      paused = 0;
      weeks += 1;
      if (weeks === AGENCY_QUALIFYING_WEEKS && !qualifiedOn) qualifiedOn = addDays(week, 7);
    } else if (inWeek(week, onLeave(PAUSES))) paused += 1;
    else gap += 1;
  }
  // A long break up to now means the next week worked starts again from nothing.
  if (gap > MAX_BREAK_WEEKS || paused > MAX_PAUSE_WEEKS) {
    weeks = 0;
    qualifiedOn = null;
  }
  return { weeks, qualifiedOn, expectedOn: qualifiedOn ? null : addDays(week, 7 * (AGENCY_QUALIFYING_WEEKS - weeks)), restartedOn };
};
