import { addDays } from "./time";
import type { LocalDate } from "./types";

/**
 * Employment (Allocation of Tips) Act 2023, in force 1 October 2024: all qualifying tips go to workers
 * without deductions, shared fairly, paid by the end of the month after they were received, with records
 * kept for three years and a written policy available to staff.
 */
export const TIPS_LEGAL_REF = "Employment Rights Act 1996, Part 2A (inserted by the Employment (Allocation of Tips) Act 2023); Code of Practice on fair and transparent distribution of tips";

/** Years tip records must be kept. */
export const TIP_RECORD_YEARS = 3;

export type TipMethod = "hours" | "equal";

export interface TipShare {
  workerId: string;
  hours: number;
  pence: number;
}

/**
 * Splits a tip pool so every penny goes to staff: each person gets their exact share rounded down, and the
 * pennies left over go to the largest remainders (ties broken by worker id, so the result is repeatable).
 */
export const allocateTips = (totalPence: number, hours: { workerId: string; hours: number }[], method: TipMethod = "hours"): TipShare[] => {
  if (!Number.isInteger(totalPence) || totalPence < 0) throw new Error("Tip total must be a whole number of pence");
  const eligible = hours.filter((h) => h.hours > 0);
  if (eligible.length === 0) return [];
  const weight = (h: { hours: number }) => (method === "equal" ? 1 : h.hours);
  const totalWeight = eligible.reduce((s, h) => s + weight(h), 0);
  const exact = eligible.map((h) => ({ ...h, exact: (totalPence * weight(h)) / totalWeight }));
  const shares = exact.map((e) => ({ workerId: e.workerId, hours: e.hours, pence: Math.floor(e.exact), remainder: e.exact - Math.floor(e.exact) }));
  let left = totalPence - shares.reduce((s, x) => s + x.pence, 0);
  for (const s of [...shares].sort((a, b) => b.remainder - a.remainder || (a.workerId < b.workerId ? -1 : 1))) {
    if (left <= 0) break;
    s.pence += 1;
    left -= 1;
  }
  return shares.map(({ workerId, hours, pence }) => ({ workerId, hours, pence }));
};

/** Tips must reach staff by the last day of the month after the month they were received. */
export const tipsPayBy = (receivedOn: LocalDate): LocalDate => {
  const [y, m] = receivedOn.split("-").map(Number) as [number, number];
  const firstOfMonthAfterNext = m >= 11 ? `${y + 1}-${String(m - 10).padStart(2, "0")}-01` : `${y}-${String(m + 2).padStart(2, "0")}-01`;
  return addDays(firstOfMonthAfterNext, -1);
};

/** A starting tipping policy, written in plain English, for a business to adapt. */
export const defaultTippingPolicy = (businessName: string) =>
  [
    `How tips are shared at ${businessName}`,
    "",
    "1. All tips, gratuities and service charges paid by customers go to staff. The business keeps nothing, and makes no deductions except income tax and National Insurance where the law requires them.",
    "2. Tips paid by card and cash handed to the business go into one shared pool.",
    "3. The pool is shared between everyone who worked in the period, in proportion to the hours they worked, as confirmed on their timesheets. This includes kitchen and other staff, not just people serving customers.",
    "4. Tips are paid with wages, no later than the end of the month after they were received.",
    "5. A tip given directly to you in cash and kept by you is yours. It is not added to the pool unless you choose to add it.",
    "6. You can see your share of each pool in VicisRota. You can also ask for a copy of the tip records about you, going back three years, and we will provide it within four weeks.",
    "7. If you think tips have not been shared fairly, speak to a manager. You also have the right to bring a claim to an employment tribunal.",
  ].join("\n");
