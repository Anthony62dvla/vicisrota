import { addDays, HOUR, londonParts, ms, paidMillis, shiftsByWorker, weekStart } from "../time";
import type { Finding, PayRate, Rule } from "../types";
import { minimumRatePence } from "./minimumWage";

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const fmt = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

const rateOn = (rates: PayRate[], date: string) =>
  rates.filter((r) => r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]?.hourlyPence ?? 0;

/**
 * Care workers are often paid only for time at each visit. Travel between visits is working time for the
 * minimum wage, so the week's pay is compared with the minimum for visit time plus travel time. Pay is
 * averaged over a Monday-to-Sunday week, taken as the pay reference period.
 */
export const travelTimeMinimumWage: Rule = {
  id: "nmw.travel-between-visits",
  version: 1,
  title: "Minimum wage including travel between care visits",
  legalRef: "National Minimum Wage Regulations 2015, regs 27 and 34 (travelling); HMRC guidance on social care",
  effectiveFrom: "2025-04-01",
  check(ctx) {
    if (ctx.settings?.paysTravelTime) return [];
    const workers = new Map(ctx.workers.map((w) => [w.id, w]));
    const findings: Finding[] = [];
    for (const [workerId, shifts] of shiftsByWorker(ctx.shifts)) {
      const worker = workers.get(workerId);
      if (!worker) throw new Error(`Shift for unknown worker ${workerId}`);
      const rates = (ctx.payRates ?? []).filter((r) => r.workerId === workerId);
      const weeks = new Map<string, typeof shifts>();
      for (const s of shifts) {
        const monday = weekStart(londonParts(ms(s.start)).date);
        weeks.set(monday, [...(weeks.get(monday) ?? []), s]);
      }
      for (const [monday, week] of weeks) {
        const travelMinutes = week.reduce((sum, s) => sum + (s.travelMinutesBefore ?? 0), 0);
        if (travelMinutes <= 0) continue;
        let paid = 0;
        let required = 0;
        let worked = 0;
        for (const s of week) {
          const date = londonParts(ms(s.start)).date;
          const visitHours = paidMillis(s) / HOUR;
          const travelHours = (s.travelMinutesBefore ?? 0) / 60;
          const minimum = minimumRatePence(worker, date).pence;
          paid += visitHours * rateOn(rates, date);
          required += (visitHours + travelHours) * minimum;
          worked += visitHours + travelHours;
        }
        // Allow for rounding to the penny.
        if (paid + 0.5 >= required) continue;
        const effective = paid / worked;
        const minimum = required / worked;
        findings.push({
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "block",
          workerId,
          shiftIds: week.map((s) => s.id),
          message:
            `${worker.name}'s pay for the week starting ${monday} works out at ${pounds(effective)} an hour once ` +
            `${fmt(travelMinutes / 60)} hours of travel between visits are counted. The legal minimum is ${pounds(minimum)}. ` +
            `Pay the travel time, raise the hourly rate, or reduce travel between visits.`,
          evidence: {
            weekStart: monday,
            weekEnd: addDays(monday, 6),
            travelMinutes,
            paidPence: Math.round(paid),
            requiredPence: Math.round(required),
            effectiveRatePence: Math.round(effective),
          },
          legalRef: this.legalRef,
        });
      }
    }
    return findings;
  },
};
