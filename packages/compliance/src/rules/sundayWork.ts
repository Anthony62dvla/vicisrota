import { londonParts, ms } from "../time";
import type { LocalDate, Rule } from "../types";

export const SUNDAY_LEGAL_REF = "Employment Rights Act 1996, Part IV and ss 40 to 43, 101 and 245 (Sunday working for shop and betting workers)";

/** The day the opt-out takes effect: 3 months after notice, or 1 month if the employer did not give the explanatory statement within 2 months of starting. */
export const sundayOptOutFrom = (noticeGivenOn: LocalDate, statementGiven: boolean): LocalDate => {
  const [y, m, d] = noticeGivenOn.split("-").map(Number) as [number, number, number];
  const months = statementGiven ? 3 : 1;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
};

/**
 * A shop or betting worker whose Sunday opt-out notice has run out cannot be made to work on a Sunday, and must not be
 * treated worse for refusing. They can still choose to work a particular Sunday, so this is a warning the manager
 * answers with a reason, such as "they asked to work it".
 */
export const sundayOptOut: Rule = {
  id: "shop.sunday-opt-out",
  version: 1,
  title: "Sunday working opt-out",
  legalRef: SUNDAY_LEGAL_REF,
  effectiveFrom: "1994-08-26",
  check(ctx) {
    const from = new Map(ctx.workers.filter((w) => w.sundayOptOutFrom).map((w) => [w.id, { from: w.sundayOptOutFrom!, name: w.name }]));
    if (!from.size) return [];
    return ctx.shifts.flatMap((s) => {
      const opt = from.get(s.workerId);
      if (!opt) return [];
      // Any part of the shift on a Sunday counts.
      const start = ms(s.start);
      const end = ms(s.end);
      const days = new Set<string>();
      for (let t = start; t < end; t += 3_600_000) days.add(londonParts(t).date);
      days.add(londonParts(end - 1).date);
      const sunday = [...days].find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 0 && d >= opt.from);
      if (!sunday) return [];
      return [
        {
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "warn" as const,
          workerId: s.workerId,
          shiftIds: [s.id],
          message: `${opt.name} has opted out of Sunday work, so they cannot be required to work on Sunday ${new Date(`${sunday}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long" })}. Only keep this shift if they have chosen to work it.`,
          evidence: { optedOutFrom: opt.from, sunday },
          legalRef: this.legalRef,
        },
      ];
    });
  },
};
