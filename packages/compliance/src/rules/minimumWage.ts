import { ageOn, londonParts, ms, shiftsByWorker } from "../time";
import type { Context, Finding, LocalDate, PayRate, Rule, Worker } from "../types";

/** Statutory hourly minimums in pence, from GOV.UK. Add a row each April. */
export const MINIMUM_WAGE_BANDS: { effectiveFrom: LocalDate; age21Plus: number; age18To20: number; under18: number; apprentice: number }[] = [
  { effectiveFrom: "2025-04-01", age21Plus: 1221, age18To20: 1000, under18: 755, apprentice: 755 },
  { effectiveFrom: "2026-04-01", age21Plus: 1271, age18To20: 1085, under18: 800, apprentice: 800 },
];

const latestOnOrBefore = <T extends { effectiveFrom: LocalDate }>(rows: T[], date: LocalDate): T | undefined =>
  rows.filter((r) => r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

export const minimumRatePence = (worker: Worker, on: LocalDate): { pence: number; band: string } => {
  const bands = latestOnOrBefore(MINIMUM_WAGE_BANDS, on);
  if (!bands) throw new Error(`No minimum wage rates loaded for ${on}`);
  const age = ageOn(worker.dateOfBirth, on);
  if (worker.apprenticeRateApplies) return { pence: bands.apprentice, band: "apprentice" };
  if (age >= 21) return { pence: bands.age21Plus, band: "21 and over" };
  if (age >= 18) return { pence: bands.age18To20, band: "18 to 20" };
  return { pence: bands.under18, band: "under 18" };
};

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export const minimumWage: Rule = {
  id: "nmw.hourly-rate",
  version: 1,
  title: "National Minimum Wage and National Living Wage",
  legalRef: "National Minimum Wage Act 1998; National Minimum Wage Regulations 2015",
  effectiveFrom: "2025-04-01",
  check(ctx: Context) {
    const workers = new Map(ctx.workers.map((w) => [w.id, w]));
    const findings: Finding[] = [];
    for (const [workerId, shifts] of shiftsByWorker(ctx.shifts)) {
      const worker = workers.get(workerId);
      if (!worker) throw new Error(`Shift for unknown worker ${workerId}`);
      const rates = (ctx.payRates ?? []).filter((r): r is PayRate => r.workerId === workerId);
      // Group shifts by the shortfall they share, so a birthday or April uprating shows as its own finding.
      const groups = new Map<string, { shiftIds: string[]; paid: number; required: number; band: string }>();
      for (const shift of shifts) {
        const date = londonParts(ms(shift.start)).date;
        const paid = latestOnOrBefore(rates, date);
        const required = minimumRatePence(worker, date);
        if (paid && paid.hourlyPence >= required.pence) continue;
        const paidPence = paid?.hourlyPence ?? 0;
        const key = `${paidPence}:${required.pence}`;
        const group = groups.get(key) ?? { shiftIds: [], paid: paidPence, required: required.pence, band: required.band };
        group.shiftIds.push(shift.id);
        groups.set(key, group);
      }
      for (const g of groups.values()) {
        findings.push({
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "block",
          workerId,
          shiftIds: g.shiftIds,
          message:
            g.paid === 0
              ? `${worker.name} has no pay rate set for these shifts. The legal minimum (${g.band}) is ${pounds(g.required)} an hour.`
              : `${worker.name} is paid ${pounds(g.paid)} an hour, below the legal minimum of ${pounds(g.required)} for the ${g.band} band.`,
          evidence: { paidPence: g.paid, requiredPence: g.required, band: g.band },
          legalRef: this.legalRef,
        });
      }
    }
    return findings;
  },
};
