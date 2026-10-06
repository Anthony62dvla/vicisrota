import type { PayrollLine } from "./payroll";

/** The kinds of pay VicisRota sends to payroll software, one line each per person. */
export const PAY_ITEMS = ["basic", "travel", "sleepIn", "holiday", "ssp", "tips", "shortNotice"] as const;
export type PayItem = (typeof PAY_ITEMS)[number];

/** What each pay item is called unless the business renames it to match its payroll software. */
export const DEFAULT_PAY_ITEM_NAMES: Record<PayItem, string> = {
  basic: "Basic pay",
  travel: "Travel time",
  sleepIn: "Sleep-in",
  holiday: "Holiday",
  ssp: "Statutory Sick Pay",
  tips: "Tips",
  shortNotice: "Short-notice pay",
};

export interface PayItemLine {
  payrollId: string;
  name: string;
  item: PayItem;
  /** The business's name for the item, as its payroll software knows it. */
  itemName: string;
  units: number | null;
  unit: "hours" | "days" | "sleep-ins" | null;
  ratePence: number | null;
  amountPence: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turns a pay period's summary into one line per person per kind of pay, the shape most payroll software
 * can import. Holiday is sent as time taken with its pay on the 52-week average when VicisRota has the pay
 * history to work it out, and as time only otherwise, for the payroll software to work out. People with no payroll ID are still included, with
 * an empty ID, so nobody is left out without the manager seeing it.
 */
export const payItemLines = (input: {
  lines: PayrollLine[];
  payrollIds: Map<string, string | null>;
  irregularHours: Set<string>;
  paysTravelTime: boolean;
  tipsPence: Map<string, number>;
  sspPence: Map<string, number>;
  shortNoticePence: Map<string, number>;
  /** Holiday pay on the 52-week average; null pence when there is no pay history to work it out. */
  holidayPay?: Map<string, { pence: number | null }>;
  names?: Partial<Record<PayItem, string>>;
}): PayItemLine[] => {
  const names = { ...DEFAULT_PAY_ITEM_NAMES, ...input.names };
  const out: PayItemLine[] = [];
  for (const l of input.lines) {
    const base = { payrollId: input.payrollIds.get(l.workerId) ?? "", name: l.name };
    const add = (item: PayItem, rest: Omit<PayItemLine, "payrollId" | "name" | "item" | "itemName">) =>
      out.push({ ...base, item, itemName: names[item] || DEFAULT_PAY_ITEM_NAMES[item], ...rest });
    // With one rate in the period, hours times rate is exact. With a pay rise mid-period, the total is sent without a rate.
    const rate = l.ratesPence.length === 1 ? l.ratesPence[0]! : null;
    const travelPence = input.paysTravelTime && rate !== null ? Math.round(l.travelHours * rate) : 0;
    const basicPence = l.grossPence - travelPence - l.sleepInPence;
    if (l.hours > 0 || basicPence > 0) {
      add("basic", { units: l.hours, unit: "hours", ratePence: rate, amountPence: basicPence });
    }
    if (l.travelHours > 0) {
      // Unpaid travel, or paid travel at more than one rate (already in basic pay), is sent as hours only, for the record.
      add("travel", { units: l.travelHours, unit: "hours", ratePence: travelPence ? rate : null, amountPence: travelPence || null });
    }
    if (l.sleepIns > 0) {
      // Time woken to work is in basic pay. The sleep-in line is the flat payment for each night.
      const each = l.sleepInPence ? l.sleepInPence / l.sleepIns : null;
      add("sleepIn", { units: l.sleepIns, unit: "sleep-ins", ratePence: each, amountPence: l.sleepInPence || null });
    }
    if (l.holidayHours > 0 || l.holidayDays > 0) {
      const hours = input.irregularHours.has(l.workerId) || l.holidayDays === 0;
      const units = round2(hours ? l.holidayHours : l.holidayDays);
      const pence = input.holidayPay?.get(l.workerId)?.pence ?? null;
      add("holiday", { units, unit: hours ? "hours" : "days", ratePence: pence != null && units ? Math.round(pence / units) : null, amountPence: pence });
    }
    for (const [item, map] of [
      ["ssp", input.sspPence],
      ["tips", input.tipsPence],
      ["shortNotice", input.shortNoticePence],
    ] as const) {
      const pence = map.get(l.workerId);
      if (pence) add(item, { units: null, unit: null, ratePence: null, amountPence: pence });
    }
  }
  return out;
};
