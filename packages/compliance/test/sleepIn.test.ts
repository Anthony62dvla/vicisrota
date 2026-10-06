import { describe, expect, it } from "vitest";
import { payItemLines, payrollSummary, weekCost, type Shift } from "../src";

const amy = { id: "amy", name: "Amy", dateOfBirth: "1990-01-01" };
const rates = [{ workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" }];
// 22:00 to 07:00 is 9 hours.
const night = (id: string, day: number, awakeMinutes: number | null): Shift => ({
  id,
  workerId: "amy",
  start: `2026-10-${String(day).padStart(2, "0")}T22:00:00+01:00`,
  end: `2026-10-${String(day + 1).padStart(2, "0")}T07:00:00+01:00`,
  ...(awakeMinutes !== null && { sleepIn: { awakeMinutes } }),
});
const pay = (entries: Shift[], sleepInPence: number | null = 6000) =>
  payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [amy], entries, payRates: rates, sleepInPence })[0]!;

describe("sleep-ins and waking nights", () => {
  it("pays a sleep-in as the sleep-in payment plus time woken to work at the hourly rate", () => {
    const line = pay([night("a", 5, 90)]);
    // £60 sleep-in + 1.5 hours at £13 = £79.50
    expect(line).toMatchObject({ hours: 1.5, sleepIns: 1, sleepInAwakeHours: 1.5, sleepInPence: 6000, grossPence: 7950, findings: [] });
  });

  it("pays every hour of a waking night", () => {
    expect(pay([night("a", 5, null)])).toMatchObject({ hours: 9, sleepIns: 0, sleepInPence: 0, grossPence: 11700 });
  });

  it("never pays more hours awake than the sleep-in lasted", () => {
    expect(pay([night("a", 5, 600)])).toMatchObject({ hours: 9, sleepInAwakeHours: 9 });
  });

  it("flags sleep-ins when no sleep-in payment is set", () => {
    const line = pay([night("a", 5, 0)], null);
    expect(line.grossPence).toBe(0);
    expect(line.findings.map((f) => [f.ruleId, f.severity, f.message])).toEqual([
      ["care.sleep-in", "warn", "Amy did a sleep-in but no sleep-in payment is set, so only time awake working is paid."],
    ]);
  });

  it("warns when someone was awake working for most of a sleep-in", () => {
    const line = pay([night("a", 5, 300), night("b", 6, 60)]);
    expect(line.findings).toHaveLength(1);
    expect(line.findings[0]).toMatchObject({ shiftIds: ["a"], severity: "warn" });
    expect(line.findings[0]!.message).toContain("likely a waking night");
  });

  it("sends the sleep-in payment as its own pay item, apart from basic pay", () => {
    const line = pay([night("a", 5, 90), night("b", 6, 0)]);
    const none = new Map<string, number>();
    const items = payItemLines({
      lines: [line],
      payrollIds: new Map([["amy", "E1"]]),
      irregularHours: new Set(),
      paysTravelTime: false,
      tipsPence: none,
      sspPence: none,
      shortNoticePence: none,
    });
    expect(items.map((i) => [i.item, i.units, i.unit, i.ratePence, i.amountPence])).toEqual([
      ["basic", 1.5, "hours", 1300, 1950],
      ["sleepIn", 2, "sleep-ins", 6000, 12000],
    ]);
  });

  it("costs a planned sleep-in at the sleep-in payment, while still counting its hours", () => {
    const cost = weekCost([night("a", 5, 0)], rates, { sleepInPence: 6000 });
    expect([cost.hours, cost.pence]).toEqual([9, 6000]);
  });
});
