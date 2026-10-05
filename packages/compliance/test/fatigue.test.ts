import { describe, expect, it } from "vitest";
import { evaluate, fatigue, type Context, type Shift } from "../src/index";

const worker = { id: "w", name: "Sam", dateOfBirth: "1990-01-01" };
// October 2026 is British Summer Time until the 25th, so UK time is UTC+1.
const shift = (id: string, date: string, start: string, end: string, endDate = date): Shift => ({
  id,
  workerId: "w",
  start: `${date}T${start}:00+01:00`,
  end: `${endDate}T${end}:00+01:00`,
  breaks: [{ start: `${date}T${start}:00+01:00`, end: `${date}T${start.slice(0, 2)}:30:00+01:00` }],
});
const next = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const check = (shifts: Shift[]) => {
  const ctx: Context = { asOf: "2026-10-20", workers: [worker], shifts, payRates: [] };
  return evaluate(ctx, [fatigue]).findings;
};

describe("fatigue warnings", () => {
  it("warns about more than 4 nights in a row, and never blocks", () => {
    const nights = [0, 1, 2, 3, 4].map((i) => shift(`n${i}`, next("2026-10-05", i), "22:00", "07:00", next("2026-10-05", i + 1)));
    const findings = check(nights);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: "warn", shiftIds: ["n0", "n1", "n2", "n3", "n4"], evidence: { nights: 5 } });
    expect(check(nights.slice(0, 4))).toEqual([]);
  });

  it("warns when a day shift follows nights without two nights' sleep", () => {
    const findings = check([shift("n1", "2026-10-05", "22:00", "07:00", "2026-10-06"), shift("d1", "2026-10-07", "09:00", "17:00")]);
    expect(findings.map((f) => f.shiftIds)).toEqual([["n1", "d1"]]);
    expect(findings[0]!.message).toContain("after finishing nights");
  });

  it("warns about a late finish then an early start, but not about a split shift", () => {
    const late = check([shift("a", "2026-10-05", "14:00", "23:00"), shift("b", "2026-10-06", "07:00", "15:00")]);
    expect(late).toHaveLength(1);
    expect(late[0]!.evidence).toEqual({ gapHours: 8 });
    expect(check([shift("a", "2026-10-05", "07:00", "10:00"), shift("b", "2026-10-05", "16:00", "19:00")])).toEqual([]);
  });

  it("warns about more than 6 days in a row and shifts over 12 hours", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((i) => shift(`d${i}`, next("2026-10-05", i), "09:00", "15:00"));
    expect(check(week).map((f) => f.evidence)).toEqual([{ days: 7, from: "2026-10-05" }]);
    expect(check([shift("long", "2026-10-05", "07:00", "20:00")]).map((f) => f.evidence)).toEqual([{ hours: 13 }]);
  });
});
