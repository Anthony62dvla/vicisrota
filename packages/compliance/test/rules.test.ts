import { describe, expect, it } from "vitest";
import {
  dailyRest,
  evaluate,
  irregularHoursAccrual,
  minimumRatePence,
  minimumWage,
  restBreak,
  statutoryAnnualLeaveDays,
  weeklyAverage48,
  weeklyRest,
  youngWorkerHours,
  youngWorkerNight,
  type Context,
  type Shift,
  type Worker,
} from "../src/index";

const adult: Worker = { id: "amy", name: "Amy", dateOfBirth: "1990-05-01" };
const teen: Worker = { id: "tom", name: "Tom", dateOfBirth: "2009-06-15" }; // 17 in October 2026

const shift = (id: string, workerId: string, start: string, end: string, breaks: Shift["breaks"] = []): Shift => ({
  id,
  workerId,
  start,
  end,
  breaks,
});

const ctx = (shifts: Shift[], extra: Partial<Context> = {}): Context => ({
  asOf: "2026-10-05",
  workers: [adult, teen],
  shifts,
  ...extra,
});

describe("rest break (WTR reg 12)", () => {
  it("blocks an adult shift over 6 hours with no break", () => {
    const [f] = restBreak.check(ctx([shift("s1", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T15:30:00+01:00")]));
    expect(f?.severity).toBe("block");
    expect(f?.message).toContain("20 minutes");
  });

  it("passes with a 20-minute break", () => {
    const s = shift("s1", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T15:30:00+01:00", [
      { start: "2026-10-05T12:00:00+01:00", end: "2026-10-05T12:20:00+01:00" },
    ]);
    expect(restBreak.check(ctx([s]))).toEqual([]);
  });

  it("allows exactly 6 hours without a break", () => {
    expect(restBreak.check(ctx([shift("s1", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T15:00:00+01:00")]))).toEqual([]);
  });

  it("needs 30 minutes for an under-18 after 4.5 hours", () => {
    const s = shift("s1", "tom", "2026-10-05T09:00:00+01:00", "2026-10-05T14:20:00+01:00", [
      { start: "2026-10-05T11:00:00+01:00", end: "2026-10-05T11:20:00+01:00" },
    ]);
    const [f] = restBreak.check(ctx([s]));
    expect(f?.evidence).toMatchObject({ requiredMinutes: 30, young: true });
  });
});

describe("daily rest (WTR reg 10)", () => {
  it("blocks a close then open with 9.5 hours between", () => {
    const [f] = dailyRest.check(
      ctx([
        shift("close", "amy", "2026-10-05T16:00:00+01:00", "2026-10-05T23:30:00+01:00"),
        shift("open", "amy", "2026-10-06T09:00:00+01:00", "2026-10-06T13:00:00+01:00"),
      ]),
    );
    expect(f?.shiftIds).toEqual(["close", "open"]);
    expect(f?.evidence).toMatchObject({ restHours: 9.5, requiredHours: 11 });
  });

  it("passes with exactly 11 hours", () => {
    const findings = dailyRest.check(
      ctx([
        shift("a", "amy", "2026-10-05T14:00:00+01:00", "2026-10-05T22:00:00+01:00"),
        shift("b", "amy", "2026-10-06T09:00:00+01:00", "2026-10-06T13:00:00+01:00"),
      ]),
    );
    expect(findings).toEqual([]);
  });

  it("requires 12 hours for under-18s", () => {
    const [f] = dailyRest.check(
      ctx([
        shift("a", "tom", "2026-10-05T14:00:00+01:00", "2026-10-05T21:00:00+01:00"),
        shift("b", "tom", "2026-10-06T08:30:00+01:00", "2026-10-06T12:00:00+01:00"),
      ]),
    );
    expect(f?.evidence).toMatchObject({ restHours: 11.5, requiredHours: 12 });
  });
});

describe("weekly rest (WTR reg 11)", () => {
  const daily = (workerId: string, days: number) =>
    Array.from({ length: days }, (_, i) => {
      const d = String(5 + i).padStart(2, "0");
      return shift(`d${i}`, workerId, `2026-10-${d}T09:00:00+01:00`, `2026-10-${d}T17:00:00+01:00`);
    });

  it("blocks seven days in a row with no 24-hour break", () => {
    const [f] = weeklyRest.check(ctx(daily("amy", 7)));
    expect(f?.evidence).toMatchObject({ weekStart: "2026-10-05", longestRestHours: 16 });
  });

  it("passes six days with Sunday off", () => {
    expect(weeklyRest.check(ctx(daily("amy", 6)))).toEqual([]);
  });

  it("requires 48 hours for under-18s", () => {
    const [f] = weeklyRest.check(ctx(daily("tom", 6)));
    expect(f?.evidence).toMatchObject({ requiredHours: 48, young: true });
  });
});

describe("48-hour average (WTR regs 4 and 5)", () => {
  // 17 weeks of 5 x 10.5-hour days = 52.5 hours a week.
  const heavy = Array.from({ length: 17 * 7 }, (_, i) => i)
    .filter((i) => i % 7 < 5)
    .map((i) => {
      const day = new Date(Date.UTC(2026, 5, 15) + i * 86_400_000).toISOString().slice(0, 10);
      return shift(`h${i}`, "amy", `${day}T08:00:00Z`, `${day}T18:30:00Z`);
    });

  it("blocks an average above 48 hours without an opt-out", () => {
    const [f] = weeklyAverage48.check(ctx(heavy, { asOf: "2026-10-11" }));
    expect(f?.evidence.averageWeeklyHours).toBeCloseTo(52.5);
  });

  it("allows it when the worker has opted out", () => {
    const optedOut = { ...adult, optedOutOf48HourLimit: true };
    expect(weeklyAverage48.check(ctx(heavy, { asOf: "2026-10-11", workers: [optedOut] }))).toEqual([]);
  });
});

describe("young workers (WTR regs 5A and 6A)", () => {
  it("blocks more than 8 hours in a day", () => {
    const [f] = youngWorkerHours.check(ctx([shift("s", "tom", "2026-10-10T09:00:00+01:00", "2026-10-10T18:00:00+01:00")]));
    expect(f?.evidence).toMatchObject({ workedHours: 9, limitHours: 8 });
  });

  it("blocks work after 10pm, using UK summer time", () => {
    const [f] = youngWorkerNight.check(ctx([shift("s", "tom", "2026-10-10T17:00:00+01:00", "2026-10-10T22:30:00+01:00")]));
    expect(f?.evidence).toMatchObject({ nightMinutes: 30 });
  });

  it("allows a shift ending exactly at 10pm", () => {
    expect(youngWorkerNight.check(ctx([shift("s", "tom", "2026-10-10T17:00:00+01:00", "2026-10-10T22:00:00+01:00")]))).toEqual([]);
  });

  it("uses GMT in winter: 21:30Z is 9:30pm and allowed", () => {
    expect(youngWorkerNight.check(ctx([shift("s", "tom", "2026-12-05T16:00:00Z", "2026-12-05T21:30:00Z")]))).toEqual([]);
  });

  it("stops applying once the worker turns 18", () => {
    const old = { ...teen, dateOfBirth: "2008-01-01" };
    const late = shift("s", "tom", "2026-10-10T17:00:00+01:00", "2026-10-10T23:00:00+01:00");
    expect(youngWorkerNight.check(ctx([late], { workers: [old] }))).toEqual([]);
  });
});

describe("minimum wage", () => {
  it("uses the April 2026 rates", () => {
    expect(minimumRatePence(adult, "2026-10-05")).toEqual({ pence: 1271, band: "21 and over" });
    expect(minimumRatePence({ ...adult, dateOfBirth: "2007-01-01" }, "2026-10-05")).toEqual({ pence: 1085, band: "18 to 20" });
    expect(minimumRatePence(teen, "2026-10-05")).toEqual({ pence: 800, band: "under 18" });
  });

  it("uses the April 2025 rates before the uprating", () => {
    expect(minimumRatePence(adult, "2026-03-31").pence).toBe(1221);
  });

  it("blocks pay below the National Living Wage", () => {
    const [f] = minimumWage.check(
      ctx([shift("s", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T13:00:00+01:00")], {
        payRates: [{ workerId: "amy", hourlyPence: 1250, effectiveFrom: "2026-01-01" }],
      }),
    );
    expect(f?.message).toBe("Amy is paid £12.50 an hour, below the legal minimum of £12.71 for the 21 and over band.");
  });

  it("flags a birthday that moves a worker into a higher band", () => {
    const turning18 = { ...teen, dateOfBirth: "2008-10-07" };
    const findings = minimumWage.check(
      ctx(
        [
          shift("before", "tom", "2026-10-06T09:00:00+01:00", "2026-10-06T13:00:00+01:00"),
          shift("after", "tom", "2026-10-07T09:00:00+01:00", "2026-10-07T13:00:00+01:00"),
        ],
        { workers: [turning18], payRates: [{ workerId: "tom", hourlyPence: 800, effectiveFrom: "2026-04-01" }] },
      ),
    );
    expect(findings.map((f) => f.shiftIds)).toEqual([["after"]]);
  });
});

describe("holiday", () => {
  it("accrues 12.07% of hours for irregular-hours workers", () => {
    expect(irregularHoursAccrual(100)).toBe(12.07);
  });

  it("caps regular entitlement at 28 days", () => {
    expect(statutoryAnnualLeaveDays(5)).toBe(28);
    expect(statutoryAnnualLeaveDays(6)).toBe(28);
    expect(statutoryAnnualLeaveDays(3)).toBe(16.8);
  });
});

describe("engine", () => {
  it("records rule versions and refuses to publish a blocked rota", () => {
    const result = evaluate(
      ctx([shift("s1", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T16:00:00+01:00")], {
        payRates: [{ workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" }],
      }),
    );
    expect(result.publishable).toBe(false);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["wtr.rest-break"]);
    expect(result.rulesApplied).toContainEqual({ id: "nmw.hourly-rate", version: 1 });
  });

  it("publishes a compliant rota", () => {
    const result = evaluate(
      ctx([shift("s1", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T15:00:00+01:00")], {
        payRates: [{ workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" }],
      }),
    );
    expect(result).toMatchObject({ publishable: true, findings: [] });
  });
});
