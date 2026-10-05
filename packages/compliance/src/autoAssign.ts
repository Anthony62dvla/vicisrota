import { evaluate } from "./engine";
import { HOUR, londonDateTime, ms, addDays, workedMillis } from "./time";
import type { Context, Finding, LocalDate, Shift } from "./types";

export type OpenShift = Omit<Shift, "workerId">;

export interface AutoAssignResult {
  assigned: { shiftId: string; workerId: string }[];
  /** Shifts nobody could take without a problem, with the most common reason. */
  unfilled: { shiftId: string; reason: string }[];
}

/** Problems that involve this shift for this person. */
const problemsFor = (ctx: Context, shift: OpenShift, workerId: string): Finding[] =>
  evaluate({ ...ctx, shifts: [...ctx.shifts, { ...shift, workerId }] }).findings.filter((f) => f.workerId === workerId && f.shiftIds.includes(shift.id));

/**
 * Fills open shifts for a week. A person is only given a shift when every rule passes with nothing to check:
 * no legal problem, and no warning such as times they have said they cannot work, an agreed adjustment, a
 * missing role or a tiring pattern. The hardest shifts to fill go first (fewest people who fit), and each
 * goes to whoever has the fewest hours that week so far, so extra work is shared out fairly. Same input,
 * same answer: ties are broken by id.
 */
export const autoAssign = (ctx: Context, open: OpenShift[], weekStart: LocalDate): AutoAssignResult => {
  const from = londonDateTime(weekStart, "00:00");
  const to = londonDateTime(addDays(weekStart, 7), "00:00");
  const hours = new Map<string, number>(ctx.workers.map((w) => [w.id, 0]));
  for (const s of ctx.shifts) {
    if (ms(s.start) >= from && ms(s.start) < to) hours.set(s.workerId, (hours.get(s.workerId) ?? 0) + workedMillis(s) / HOUR);
  }

  let current: Context = { ...ctx, shifts: [...ctx.shifts] };
  const result: AutoAssignResult = { assigned: [], unfilled: [] };
  let remaining = [...open];
  while (remaining.length) {
    // Who could take each remaining shift, given what has been assigned so far.
    const options = remaining
      .map((shift) => {
        const reasons: string[] = [];
        const fits = current.workers
          .map((w) => w.id)
          .filter((id) => {
            // Someone already working then cannot be in two places.
            if (current.shifts.some((s) => s.workerId === id && ms(s.start) < ms(shift.end) && ms(s.end) > ms(shift.start))) {
              reasons.push("overlap");
              return false;
            }
            const problems = problemsFor(current, shift, id);
            reasons.push(...problems.map((p) => p.ruleId));
            return problems.length === 0;
          })
          .sort((a, b) => (hours.get(a) ?? 0) - (hours.get(b) ?? 0) || a.localeCompare(b));
        return { shift, fits, reasons };
      })
      .sort((a, b) => a.fits.length - b.fits.length || ms(a.shift.start) - ms(b.shift.start) || a.shift.id.localeCompare(b.shift.id));
    const next = options[0]!;
    remaining = remaining.filter((s) => s.id !== next.shift.id);
    const workerId = next.fits[0];
    if (!workerId) {
      result.unfilled.push({ shiftId: next.shift.id, reason: mostCommon(next.reasons) });
      continue;
    }
    result.assigned.push({ shiftId: next.shift.id, workerId });
    current = { ...current, shifts: [...current.shifts, { ...next.shift, workerId }] };
    hours.set(workerId, (hours.get(workerId) ?? 0) + workedMillis({ ...next.shift, workerId }) / HOUR);
  }
  return result;
};

const REASON: Record<string, string> = {
  "wtr.daily-rest": "not enough rest between shifts",
  "wtr.weekly-rest": "not enough rest in the week",
  "wtr.48-hour-average": "over the 48-hour average",
  "wtr.rest-break": "the shift needs a longer break",
  "wtr.young-worker-hours": "under-18 working limits",
  "wtr.young-worker-night": "under-18 night work",
  "rtw.check-before-work": "right to work not checked",
  "care.enhanced-dbs": "no enhanced DBS with barred list check",
  "training.required-for-shift": "training needed for this shift",
  "nmw.hourly-rate": "pay below the minimum wage",
  "nmw.travel-between-visits": "travel time takes pay below the minimum wage",
  "leave.no-shift-during-leave": "people are on leave",
  "availability.unavailable": "people have said they cannot work then",
  "availability.adjustments": "it does not fit agreed adjustments",
  "roles.job-role": "nobody is set up for this role",
  "fatigue.patterns": "it would make a tiring pattern",
  overlap: "everyone who could do it is already working then",
};

const mostCommon = (ids: string[]) => {
  if (!ids.length) return "there is nobody on the staff list yet";
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  return REASON[top] ?? "every person has something to check";
};
