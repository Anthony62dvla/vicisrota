import { describe, expect, it } from "vitest";
import { sponsorDuties, workingDaysAfter, type SponsorDay } from "../src";

const today = "2026-10-30";
const worker = (over: Partial<Parameters<typeof sponsorDuties>[0]["workers"][number]> = {}) => ({
  id: "ana",
  name: "Ana",
  sponsorship: { route: "health_and_care" as const, weeklyHours: 37.5, annualSalaryPence: 2_500_000, startedOn: "2026-09-01" },
  leftOn: null,
  permissionEndsOn: "2028-09-01",
  ...over,
});
// Weekdays from 1 October 2026 (a Thursday).
const weekdays = (n: number, from = "2026-10-01") => {
  const out: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); out.length < n; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() % 6 !== 0) out.push(d.toISOString().slice(0, 10));
  }
  return out;
};
const day = (date: string, attended = false, onLeave = false): SponsorDay => ({ workerId: "ana", date, attended, onLeave });
const duties = (over: Partial<Parameters<typeof sponsorDuties>[0]> = {}) => sponsorDuties({ today, workers: [worker()], days: [], weeks: [], ...over });

describe("sponsored worker duties", () => {
  it("counts working days Monday to Friday", () => {
    expect(workingDaysAfter("2026-10-02", 10)).toBe("2026-10-16");
  });

  it("reports more than 10 missed rostered days in a row, within 10 working days of the 10th", () => {
    const missed = weekdays(11).map((d) => day(d));
    const [absence] = duties({ days: missed });
    expect(absence).toMatchObject({ kind: "absence", eventDate: "2026-10-01", reportBy: workingDaysAfter("2026-10-14", 10) });
    expect(absence!.message).toContain("missed 11 rostered days in a row");
  });

  it("does not count 10 missed days, days on approved leave, or a run broken by a day at work", () => {
    expect(duties({ days: weekdays(10).map((d) => day(d)) })).toEqual([]);
    const withLeave = weekdays(11).map((d, i) => day(d, false, i === 5));
    expect(duties({ days: withLeave })).toEqual([]);
    const broken = weekdays(12).map((d, i) => day(d, i === 6));
    expect(duties({ days: broken })).toEqual([]);
  });

  it("reports leaving within 10 working days", () => {
    expect(duties({ workers: [worker({ leftOn: "2026-10-23" })] })).toEqual([
      expect.objectContaining({ kind: "left", reportBy: "2026-11-06" }),
    ]);
  });

  it("flags weeks paid below the sponsored salary, but not weeks with leave or unconfirmed hours", () => {
    const week = (weekStart: string, pence: number, hadLeave = false, unconfirmed = false) => ({ workerId: "ana", weekStart, pence, hadLeave, unconfirmed });
    const found = duties({ weeks: [week("2026-10-05", 48_077), week("2026-10-12", 40_000), week("2026-10-19", 10_000, true), week("2026-10-26", 0, false, true)] });
    expect(found.map((d) => [d.kind, d.eventDate])).toEqual([["pay", "2026-10-12"]]);
    expect(found[0]!.message).toContain("paid £400.00 in the week starting Monday 12 October 2026, below the sponsored salary of £480.77 a week");
  });

  it("lists every short week in one line", () => {
    const week = (weekStart: string, pence: number) => ({ workerId: "ana", weekStart, pence, hadLeave: false, unconfirmed: false });
    const found = duties({ weeks: [week("2026-09-07", 0), week("2026-09-14", 20_800)] });
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain("below the sponsored salary of £480.77 a week in 2 weeks, starting 7 September, 14 September. The lowest was £0.00.");
  });

  it("warns 90 days before permission to work ends, and when it has ended or was never checked", () => {
    expect(duties({ workers: [worker({ permissionEndsOn: "2027-01-15" })] })[0]).toMatchObject({ kind: "permission_ending" });
    expect(duties({ workers: [worker({ permissionEndsOn: "2027-03-15" })] })).toEqual([]);
    expect(duties({ workers: [worker({ permissionEndsOn: "2026-10-01" })] })[0]).toMatchObject({ kind: "permission_ended" });
    expect(duties({ workers: [worker({ permissionEndsOn: undefined })] })[0]).toMatchObject({ kind: "no_check" });
  });
});
