import { describe, expect, it } from "vitest";
import { payItemLines, type PayrollLine } from "../src/index";

const line = (over: Partial<PayrollLine>): PayrollLine => ({
  workerId: "w1",
  name: "Jo Bell",
  hours: 0,
  travelHours: 0,
  sleepIns: 0,
  sleepInAwakeHours: 0,
  sleepInPence: 0,
  grossPence: 0,
  ratesPence: [],
  holidayHoursAccrued: null,
  holidayDays: 0,
  holidayHours: 0,
  sickDays: 0,
  otherLeaveDays: 0,
  findings: [],
  ...over,
});
const none = new Map<string, number>();
const base = { payrollIds: new Map([["w1", "E001"]]), irregularHours: new Set<string>(), paysTravelTime: false, tipsPence: none, sspPence: none, shortNoticePence: none };

describe("pay items for payroll software", () => {
  it("sends basic hours at the rate, and each other kind of pay on its own line", () => {
    const items = payItemLines({
      ...base,
      lines: [line({ hours: 30, grossPence: 39000, ratesPence: [1300], holidayDays: 2 })],
      tipsPence: new Map([["w1", 1250]]),
      sspPence: new Map([["w1", 2465]]),
      shortNoticePence: new Map([["w1", 9750]]),
    });
    expect(items.map((i) => [i.payrollId, i.itemName, i.units, i.unit, i.ratePence, i.amountPence])).toEqual([
      ["E001", "Basic pay", 30, "hours", 1300, 39000],
      ["E001", "Holiday", 2, "days", null, null],
      ["E001", "Statutory Sick Pay", null, null, null, 2465],
      ["E001", "Tips", null, null, null, 1250],
      ["E001", "Short-notice pay", null, null, null, 9750],
    ]);
  });

  it("splits paid travel out of basic pay, and uses the business's own names", () => {
    const items = payItemLines({
      ...base,
      paysTravelTime: true,
      names: { basic: "BASIC", travel: "TRAVEL" },
      lines: [line({ hours: 20, travelHours: 2.5, grossPence: 1300 * 22.5, ratesPence: [1300] })],
    });
    expect(items.map((i) => [i.itemName, i.units, i.amountPence])).toEqual([
      ["BASIC", 20, 26000],
      ["TRAVEL", 2.5, 3250],
    ]);
  });

  it("sends the total without a rate when pay changed mid-period, and holiday in hours for irregular hours", () => {
    const items = payItemLines({
      ...base,
      irregularHours: new Set(["w1"]),
      lines: [line({ hours: 10, grossPence: 13500, ratesPence: [1300, 1400], holidayHours: 7.5 })],
    });
    expect(items.map((i) => [i.item, i.units, i.unit, i.ratePence, i.amountPence])).toEqual([
      ["basic", 10, "hours", null, 13500],
      ["holiday", 7.5, "hours", null, null],
    ]);
  });

  it("sends holiday pay worked out on the 52-week average, with a day rate", () => {
    const items = payItemLines({ ...base, holidayPay: new Map([["w1", { pence: 20_000 }]]), lines: [line({ hours: 30, grossPence: 39000, ratesPence: [1300], holidayDays: 2 })] });
    expect(items.find((i) => i.item === "holiday")).toMatchObject({ units: 2, unit: "days", ratePence: 10_000, amountPence: 20_000 });
  });

  it("keeps people with no payroll ID, with the ID left empty", () => {
    const items = payItemLines({ ...base, payrollIds: new Map(), lines: [line({ hours: 1, grossPence: 1300, ratesPence: [1300] })] });
    expect(items[0]?.payrollId).toBe("");
  });
});
