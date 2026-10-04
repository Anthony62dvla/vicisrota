import { HOUR, londonParts, ms, workedMillis } from "./time";
import type { LocalDate, PayRate, Shift } from "./types";

/** A shift as planned on the rota. Open shifts have no worker yet. */
export interface PlannedShift extends Omit<Shift, "workerId"> {
  workerId: string | null;
}

export interface WeekCost {
  /** Paid hours and wages per person, from the rate in force on the day each shift starts. */
  byWorker: Map<string, { hours: number; pence: number }>;
  hours: number;
  pence: number;
  /** Open shifts cannot be costed until someone takes them. */
  openHours: number;
  /** People with shifts but no pay rate on that day, so their wages are missing from the total. */
  missingRate: string[];
}

const rateOn = (rates: PayRate[], workerId: string, date: LocalDate) =>
  rates.filter((r) => r.workerId === workerId && r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

/**
 * Planned hours and basic wages for a set of shifts: time on shift minus unpaid breaks, plus travel
 * between care visits when the business pays it. Leaves out holiday pay, employer National
 * Insurance and pension, which depend on payroll.
 */
export const weekCost = (shifts: PlannedShift[], rates: PayRate[], opts: { paysTravelTime?: boolean } = {}): WeekCost => {
  const byWorker = new Map<string, { hours: number; pence: number }>();
  const missing = new Set<string>();
  let openMillis = 0;
  for (const s of shifts) {
    const millis = workedMillis(s as Shift) + (opts.paysTravelTime ? (s.travelMinutesBefore ?? 0) * 60_000 : 0);
    if (!s.workerId) {
      openMillis += millis;
      continue;
    }
    const rate = rateOn(rates, s.workerId, londonParts(ms(s.start)).date);
    if (!rate) missing.add(s.workerId);
    const line = byWorker.get(s.workerId) ?? { hours: 0, pence: 0 };
    line.hours += millis / HOUR;
    line.pence += rate ? Math.round((millis / HOUR) * rate.hourlyPence) : 0;
    byWorker.set(s.workerId, line);
  }
  const lines = [...byWorker.values()];
  return {
    byWorker,
    hours: lines.reduce((t, l) => t + l.hours, 0),
    pence: lines.reduce((t, l) => t + l.pence, 0),
    openHours: openMillis / HOUR,
    missingRate: [...missing],
  };
};
