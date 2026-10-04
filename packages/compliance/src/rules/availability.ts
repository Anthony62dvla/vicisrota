import { addDays, londonDateTime, londonParts, ms, overlap } from "../time";
import type { Finding, LocalDate, Rule, Shift, Worker } from "../types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/** 1 = Monday to 7 = Sunday. */
const weekdayOf = (date: LocalDate) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const at = (date: LocalDate, time: string) => (time === "24:00" ? londonDateTime(addDays(date, 1), "00:00") : londonDateTime(date, time));
const hhmm = (t: number) => {
  const p = londonParts(t);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

const byWorker = (ctx: { workers: Worker[] }) => new Map(ctx.workers.map((w) => [w.id, w]));

const finding = (rule: Rule, worker: Worker, shift: Shift, message: string, evidence: Finding["evidence"]): Finding => ({
  ruleId: rule.id,
  ruleVersion: rule.version,
  severity: "warn",
  workerId: worker.id,
  shiftIds: [shift.id],
  message,
  evidence,
  legalRef: rule.legalRef,
});

/**
 * Times someone has said they cannot work. Not a legal limit, so it warns rather than blocks, but
 * booking people when they have said they cannot come is the quickest way to lose them.
 */
export const unavailableTimes: Rule = {
  id: "availability.unavailable",
  version: 1,
  title: "Times the person cannot work",
  legalRef: "Availability given by the person. Not a legal limit, but it may reflect caring duties or a flexible working agreement (Employment Rights Act 1996, Part 8A).",
  effectiveFrom: "2000-01-01",
  check(ctx) {
    const workers = byWorker(ctx);
    return ctx.shifts.flatMap((shift) => {
      const worker = workers.get(shift.workerId);
      if (!worker?.unavailable?.length) return [];
      const start = ms(shift.start);
      const end = ms(shift.end);
      // The day before covers a slot that runs to midnight and a shift starting just after it.
      for (let date = addDays(londonParts(start).date, -1); date <= londonParts(end - 1).date; date = addDays(date, 1)) {
        const slot = worker.unavailable.find((u) => u.weekday === weekdayOf(date) && overlap(start, end, at(date, u.from), at(date, u.to)) > 0);
        if (slot) {
          const day = DAY_NAMES[slot.weekday - 1]!;
          return [
            finding(this, worker, shift, `${worker.name} has said they cannot work on ${day}s from ${slot.from} to ${slot.to}. Check with them before relying on this shift.`, {
              weekday: slot.weekday,
              from: slot.from,
              to: slot.to,
              date,
            }),
          ];
        }
      }
      return [];
    });
  },
};

/** Adjustments agreed with the person. Failing to make reasonable adjustments can be disability discrimination. */
export const agreedAdjustments: Rule = {
  id: "availability.adjustments",
  version: 1,
  title: "Agreed adjustments",
  legalRef: "Equality Act 2010, ss. 20 and 21 (duty to make reasonable adjustments)",
  effectiveFrom: "2010-10-01",
  check(ctx) {
    const workers = byWorker(ctx);
    return ctx.shifts.flatMap((shift) => {
      const worker = workers.get(shift.workerId);
      const a = worker?.adjustments;
      if (!worker || !a) return [];
      const start = ms(shift.start);
      const end = ms(shift.end);
      const problems: { what: string; evidence: Finding["evidence"] }[] = [];
      if (a.maxShiftHours && end - start > a.maxShiftHours * 3_600_000)
        problems.push({ what: `shifts no longer than ${a.maxShiftHours} hours, and this one is ${+((end - start) / 3_600_000).toFixed(1)} hours`, evidence: { maxShiftHours: a.maxShiftHours, shiftHours: (end - start) / 3_600_000 } });
      if (a.earliestStart && hhmm(start) < a.earliestStart)
        problems.push({ what: `starting no earlier than ${a.earliestStart}, and this one starts at ${hhmm(start)}`, evidence: { earliestStart: a.earliestStart, starts: hhmm(start) } });
      if (a.latestFinish) {
        const startDate = londonParts(start).date;
        const lateFinish = londonParts(end).date > startDate ? end > at(startDate, "24:00") || a.latestFinish !== "24:00" : hhmm(end) > a.latestFinish;
        if (lateFinish) problems.push({ what: `finishing by ${a.latestFinish}, and this one finishes at ${hhmm(end)}`, evidence: { latestFinish: a.latestFinish, finishes: hhmm(end) } });
      }
      return problems.map((p) =>
        finding(this, worker, shift, `${worker.name} has an agreed adjustment: ${p.what}. Change the shift, or talk to them first.`, p.evidence),
      );
    });
  },
};
