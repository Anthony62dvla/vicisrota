import { describe, expect, it } from "vitest";
import {
  loneWorkStatus,
  type LoneCheckKind,
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
  enhancedDbs,
  requiredTraining,
  rightToWork,
  annualEntitlementDays,
  leaveYear,
  noShiftDuringLeave,
  payrollSummary,
  allocateTips,
  tipsPayBy,
  travelTimeMinimumWage,
  toCsv,
  csvCell,
  type Context,
  type Shift,
  type Worker,
} from "../src/index";

const rtw = [{ kind: "right_to_work" as const, checkedOn: "2026-01-05" }];
const adult: Worker = { id: "amy", name: "Amy", dateOfBirth: "1990-05-01", checks: rtw };
const teen: Worker = { id: "tom", name: "Tom", dateOfBirth: "2009-06-15", checks: rtw }; // 17 in October 2026

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

  it("allows split shifts and runs of visits when the day still has 11 hours' rest", () => {
    const findings = dailyRest.check(
      ctx([
        shift("v1", "amy", "2026-10-05T08:00:00+01:00", "2026-10-05T09:00:00+01:00"),
        shift("v2", "amy", "2026-10-05T09:20:00+01:00", "2026-10-05T10:20:00+01:00"),
        shift("v3", "amy", "2026-10-05T17:00:00+01:00", "2026-10-05T21:00:00+01:00"),
        shift("v4", "amy", "2026-10-06T08:00:00+01:00", "2026-10-06T09:00:00+01:00"),
      ]),
    );
    expect(findings).toEqual([]);
  });

  it("blocks a split shift that leaves less than 11 hours' rest before the next morning", () => {
    const findings = dailyRest.check(
      ctx([
        shift("lunch", "amy", "2026-10-05T11:00:00+01:00", "2026-10-05T15:00:00+01:00"),
        shift("dinner", "amy", "2026-10-05T18:00:00+01:00", "2026-10-05T23:00:00+01:00"),
        shift("breakfast", "amy", "2026-10-06T07:00:00+01:00", "2026-10-06T11:00:00+01:00"),
      ]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ shiftIds: ["dinner", "breakfast"], evidence: { restHours: 8 } });
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

describe("UK time helpers", () => {
  it("reads rota times as UK local time in summer and winter", async () => {
    const { londonDateTime } = await import("../src/index");
    expect(new Date(londonDateTime("2026-07-01", "09:30")).toISOString()).toBe("2026-07-01T08:30:00.000Z");
    expect(new Date(londonDateTime("2026-12-01", "09:30")).toISOString()).toBe("2026-12-01T09:30:00.000Z");
  });

  it("rejects an impossible time", async () => {
    const { londonDateTime } = await import("../src/index");
    expect(() => londonDateTime("2026-07-01", "25:00")).toThrow();
  });
});

describe("right to work", () => {
  const monday = shift("s", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T13:00:00+01:00");

  it("blocks a shift with no check on file", () => {
    const [f] = rightToWork.check(ctx([monday], { workers: [{ ...adult, checks: [] }] }));
    expect(f?.severity).toBe("block");
  });

  it("blocks a check done after the shift date", () => {
    const late = { ...adult, checks: [{ kind: "right_to_work" as const, checkedOn: "2026-10-06" }] };
    expect(rightToWork.check(ctx([monday], { workers: [late] }))[0]?.severity).toBe("block");
  });

  it("blocks once time-limited permission has ended", () => {
    const expired = { ...adult, checks: [{ kind: "right_to_work" as const, checkedOn: "2025-01-01", expiresOn: "2026-10-01" }] };
    expect(rightToWork.check(ctx([monday], { workers: [expired] }))[0]?.severity).toBe("block");
  });

  it("warns when a follow-up check is due within 28 days", () => {
    const soon = { ...adult, checks: [{ kind: "right_to_work" as const, checkedOn: "2025-01-01", expiresOn: "2026-10-20" }] };
    const [f] = rightToWork.check(ctx([monday], { workers: [soon] }));
    expect(f).toMatchObject({ severity: "warn", evidence: { expiresOn: "2026-10-20" } });
  });

  it("passes an open-ended check", () => {
    expect(rightToWork.check(ctx([monday]))).toEqual([]);
  });
});

describe("enhanced DBS for care", () => {
  const monday = shift("s", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T13:00:00+01:00");
  const care = { settings: { requireEnhancedDbs: true } };

  it("is not required outside care", () => {
    expect(enhancedDbs.check(ctx([monday]))).toEqual([]);
  });

  it("blocks without an enhanced check with barred list", () => {
    const basic = { ...adult, checks: [...rtw, { kind: "dbs" as const, checkedOn: "2026-01-01", dbsLevel: "enhanced" as const }] };
    expect(enhancedDbs.check(ctx([monday], { ...care, workers: [basic] }))[0]?.severity).toBe("block");
  });

  it("passes with an enhanced check with barred list", () => {
    const ok = { ...adult, checks: [...rtw, { kind: "dbs" as const, checkedOn: "2026-01-01", dbsLevel: "enhanced_barred" as const }] };
    expect(enhancedDbs.check(ctx([monday], { ...care, workers: [ok] }))).toEqual([]);
  });
});

describe("training a shift needs", () => {
  const meds = { id: "q-meds", name: "medication competency" };
  const medsShift = { ...shift("s", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T13:00:00+01:00"), requiredQualifications: [meds] };

  it("blocks when the person does not hold it", () => {
    const [f] = requiredTraining.check(ctx([medsShift]));
    expect(f?.message).toBe("Amy does not have medication competency, which this shift needs.");
  });

  it("blocks when it has expired", () => {
    const lapsed = { ...adult, qualifications: [{ ...meds, expiresOn: "2026-09-30" }] };
    const [f] = requiredTraining.check(ctx([medsShift], { workers: [lapsed] }));
    expect(f?.message).toBe("Amy's medication competency expired on 2026-09-30, and this shift needs it.");
  });

  it("passes when current", () => {
    const current = { ...adult, qualifications: [{ ...meds, expiresOn: "2027-09-30" }] };
    expect(requiredTraining.check(ctx([medsShift], { workers: [current] }))).toEqual([]);
  });
});

describe("leave", () => {
  const tuesday = shift("s", "amy", "2026-10-06T09:00:00+01:00", "2026-10-06T17:00:00+01:00");
  const holiday = { workerId: "amy", kind: "annual" as const, startsOn: "2026-10-06", endsOn: "2026-10-09" };

  it("blocks a shift during approved holiday", () => {
    const [f] = noShiftDuringLeave.check(ctx([tuesday], { leave: [{ ...holiday, status: "approved" }] }));
    expect(f).toMatchObject({ severity: "block", evidence: { date: "2026-10-06" } });
    expect(f?.message).toContain("approved holiday");
  });

  it("warns about a shift during leave that has only been requested", () => {
    const [f] = noShiftDuringLeave.check(ctx([tuesday], { leave: [{ ...holiday, status: "requested" }] }));
    expect(f?.severity).toBe("warn");
  });

  it("catches an overnight shift that runs into the first day of leave", () => {
    const night = shift("n", "amy", "2026-10-05T22:00:00+01:00", "2026-10-06T06:00:00+01:00");
    expect(noShiftDuringLeave.check(ctx([night], { leave: [{ ...holiday, status: "approved" }] }))).toHaveLength(1);
  });

  it("allows a shift that ends at midnight before leave starts", () => {
    const evening = shift("e", "amy", "2026-10-05T16:00:00+01:00", "2026-10-06T00:00:00+01:00");
    expect(noShiftDuringLeave.check(ctx([evening], { leave: [{ ...holiday, status: "approved" }] }))).toEqual([]);
  });

  it("ignores other people's leave", () => {
    expect(noShiftDuringLeave.check(ctx([tuesday], { leave: [{ ...holiday, workerId: "tom", status: "approved" }] }))).toEqual([]);
  });
});

describe("holiday entitlement", () => {
  it("finds the leave year for January and April starts", () => {
    expect(leaveYear("2026-10-03")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(leaveYear("2026-02-10", 4)).toEqual({ start: "2025-04-01", end: "2026-03-31" });
  });

  it("gives a full year's leave to someone already employed", () => {
    expect(annualEntitlementDays({ daysWorkedPerWeek: 5, year: leaveYear("2026-10-03"), employmentStart: "2024-03-01" })).toBe(28);
    expect(annualEntitlementDays({ daysWorkedPerWeek: 3, year: leaveYear("2026-10-03") })).toBe(16.8);
  });

  it("pro-rates a part-year starter and rounds up to the next half day", () => {
    // 1 July to 31 December is 184 of 365 days: 28 x 184 / 365 = 14.1, rounded up to 14.5.
    expect(annualEntitlementDays({ daysWorkedPerWeek: 5, year: leaveYear("2026-10-03"), employmentStart: "2026-07-01" })).toBe(14.5);
  });
});

describe("payroll", () => {
  const rates = [
    { workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" },
    { workerId: "amy", hourlyPence: 1400, effectiveFrom: "2026-10-07" },
  ];
  const entries = [
    shift("a", "amy", "2026-10-05T09:00:00+01:00", "2026-10-05T17:00:00+01:00", [
      { start: "2026-10-05T12:00:00+01:00", end: "2026-10-05T12:30:00+01:00" },
    ]),
    shift("b", "amy", "2026-10-07T09:00:00+01:00", "2026-10-07T13:00:00+01:00"),
  ];

  it("pays each piece of work at the rate in force that day", () => {
    const [amy] = payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [adult], entries, payRates: rates });
    // 7.5h at £13 + 4h at £14 = £97.50 + £56 = £153.50
    expect(amy).toMatchObject({ hours: 11.5, travelHours: 0, grossPence: 15350, ratesPence: [1300, 1400], holidayHoursAccrued: null, findings: [] });
  });

  it("builds up holiday hours for irregular-hours workers", () => {
    const [amy] = payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [{ ...adult, irregularHours: true }], entries, payRates: rates });
    expect(amy?.holidayHoursAccrued).toBe(1.39); // 11.5 x 12.07%
  });

  it("flags pay below the minimum wage", () => {
    const low = [{ workerId: "amy", hourlyPence: 1100, effectiveFrom: "2026-04-01" }];
    const [amy] = payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [adult], entries, payRates: low });
    expect(amy?.findings[0]?.ruleId).toBe("nmw.hourly-rate");
  });

  it("counts leave in the period", () => {
    const [amy] = payrollSummary({
      from: "2026-10-05",
      to: "2026-10-11",
      workers: [adult],
      entries: [],
      payRates: rates,
      leave: [
        { workerId: "amy", kind: "annual", status: "approved", startsOn: "2026-10-08", endsOn: "2026-10-09", days: 2 },
        { workerId: "amy", kind: "sick", status: "approved", startsOn: "2026-10-01", endsOn: "2026-10-06" },
        { workerId: "amy", kind: "annual", status: "requested", startsOn: "2026-10-10", endsOn: "2026-10-10", days: 1 },
      ],
    });
    expect(amy).toMatchObject({ holidayDays: 2, sickDays: 2, otherLeaveDays: 0 });
  });
});

describe("CSV export", () => {
  it("quotes commas and stops spreadsheet formulas", () => {
    expect(toCsv([["Smith, Jo", "=HYPERLINK(\"x\")", 12.5, null]])).toBe('"Smith, Jo","\'=HYPERLINK(""x"")",12.5,\r\n');
  });

  it("keeps negative numbers as numbers", () => {
    expect(csvCell(-2)).toBe("-2");
  });
});

describe("travel between care visits", () => {
  // Three 1-hour visits on Monday with 20 minutes' travel before the second and third.
  const visits = (travel: number): Shift[] => [
    { ...shift("v1", "amy", "2026-10-05T08:00:00+01:00", "2026-10-05T09:00:00+01:00") },
    { ...shift("v2", "amy", "2026-10-05T09:20:00+01:00", "2026-10-05T10:20:00+01:00"), travelMinutesBefore: travel },
    { ...shift("v3", "amy", "2026-10-05T10:40:00+01:00", "2026-10-05T11:40:00+01:00"), travelMinutesBefore: travel },
  ];
  const rate = (pence: number) => [{ workerId: "amy", hourlyPence: pence, effectiveFrom: "2026-04-01" }];

  it("blocks when unpaid travel pulls pay below the minimum", () => {
    // £13.00 x 3h = £39.00 for 3h 40m of work: £10.64 an hour, below £12.71.
    const [f] = travelTimeMinimumWage.check(ctx(visits(20), { payRates: rate(1300) }));
    expect(f).toMatchObject({ severity: "block", evidence: { travelMinutes: 40, paidPence: 3900, effectiveRatePence: 1064 } });
    expect(f?.shiftIds).toEqual(["v1", "v2", "v3"]);
  });

  it("passes when the hourly rate covers the travel", () => {
    // £15.60 x 3h = £46.80 for 3h 40m: £12.76 an hour.
    expect(travelTimeMinimumWage.check(ctx(visits(20), { payRates: rate(1560) }))).toEqual([]);
  });

  it("passes when the business pays travel time", () => {
    expect(travelTimeMinimumWage.check(ctx(visits(20), { payRates: rate(1300), settings: { paysTravelTime: true } }))).toEqual([]);
  });

  it("ignores shifts with no travel", () => {
    expect(travelTimeMinimumWage.check(ctx(visits(0), { payRates: rate(1300) }))).toEqual([]);
  });
});

describe("payroll with travel between visits", () => {
  const visits: Shift[] = [
    shift("v1", "amy", "2026-10-05T08:00:00+01:00", "2026-10-05T09:00:00+01:00"),
    { ...shift("v2", "amy", "2026-10-05T09:30:00+01:00", "2026-10-05T10:30:00+01:00"), travelMinutesBefore: 30 },
  ];
  const payRates = [{ workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" }];

  it("pays travel at the hourly rate when the business pays travel time", () => {
    const [amy] = payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [adult], entries: visits, payRates, paysTravelTime: true });
    expect(amy).toMatchObject({ hours: 2, travelHours: 0.5, grossPence: 3250, findings: [] });
  });

  it("flags unpaid travel that pulls pay below the minimum", () => {
    const [amy] = payrollSummary({ from: "2026-10-05", to: "2026-10-11", workers: [adult], entries: visits, payRates });
    expect(amy?.grossPence).toBe(2600);
    expect(amy?.findings.map((f) => f.ruleId)).toEqual(["nmw.travel-between-visits"]);
  });
});

describe("tips", () => {
  it("shares tips by hours worked and hands out every penny", () => {
    const shares = allocateTips(10000, [
      { workerId: "a", hours: 10 },
      { workerId: "b", hours: 20 },
      { workerId: "c", hours: 0 },
    ]);
    expect(shares).toEqual([
      { workerId: "a", hours: 10, pence: 3333 },
      { workerId: "b", hours: 20, pence: 6667 },
    ]);
  });

  it("never loses or invents pennies", () => {
    const shares = allocateTips(1001, [
      { workerId: "a", hours: 7.5 },
      { workerId: "b", hours: 7.5 },
      { workerId: "c", hours: 7.5 },
    ]);
    expect(shares.reduce((s, x) => s + x.pence, 0)).toBe(1001);
    expect(shares.map((s) => s.pence).sort()).toEqual([333, 334, 334]);
  });

  it("can share equally", () => {
    expect(allocateTips(900, [{ workerId: "a", hours: 2 }, { workerId: "b", hours: 40 }], "equal").map((s) => s.pence)).toEqual([450, 450]);
  });

  it("must be paid by the end of the following month", () => {
    expect(tipsPayBy("2026-10-03")).toBe("2026-11-30");
    expect(tipsPayBy("2026-11-15")).toBe("2026-12-31");
    expect(tipsPayBy("2026-12-31")).toBe("2027-01-31");
    expect(tipsPayBy("2027-01-31")).toBe("2027-02-28");
  });
});

describe("lone working check-ins", () => {
  const H = 3_600_000;
  const M = 60_000;
  const base = { start: 10 * H, end: 14 * H, intervalMinutes: 60 };
  const at = (kind: LoneCheckKind, t: number) => ({ kind, at: t });

  it("waits for the shift to start, then allows the grace period", () => {
    expect(loneWorkStatus({ ...base, checks: [], now: 9 * H }).state).toBe("not_started");
    expect(loneWorkStatus({ ...base, checks: [], now: 10 * H + 10 * M }).state).toBe("ok");
    const late = loneWorkStatus({ ...base, checks: [], now: 10 * H + 16 * M });
    expect(late.state).toBe("overdue");
    expect(late.reason).toMatch(/start/);
  });

  it("expects a check-in each interval after the last one", () => {
    const checks = [at("start", 10 * H), at("ok", 11 * H)];
    expect(loneWorkStatus({ ...base, checks, now: 12 * H + 10 * M })).toEqual({ state: "ok", dueAt: 12 * H });
    expect(loneWorkStatus({ ...base, checks, now: 12 * H + 16 * M }).state).toBe("overdue");
    // The manager reached them: the clock restarts from then.
    expect(loneWorkStatus({ ...base, checks: [...checks, at("resolved", 12 * H + 20 * M)], now: 12 * H + 30 * M })).toEqual({ state: "ok", dueAt: 13 * H + 20 * M });
  });

  it("expects a check-out at the end of the shift", () => {
    const checks = [at("start", 10 * H), at("ok", 13 * H + 30 * M)];
    expect(loneWorkStatus({ ...base, checks, now: 14 * H }).dueAt).toBe(14 * H);
    const missed = loneWorkStatus({ ...base, checks, now: 14 * H + 20 * M });
    expect(missed.state).toBe("overdue");
    expect(missed.reason).toMatch(/end/);
    expect(loneWorkStatus({ ...base, checks: [...checks, at("finished", 14 * H)], now: 20 * H }).state).toBe("finished");
  });

  it("keeps a call for help open until a manager deals with it", () => {
    const help = [at("start", 10 * H), at("help", 10 * H + 30 * M)];
    expect(loneWorkStatus({ ...base, checks: help, now: 11 * H }).state).toBe("help");
    // Saying "I'm OK" afterwards does not close it: someone must check.
    expect(loneWorkStatus({ ...base, checks: [...help, at("ok", 10 * H + 40 * M)], now: 11 * H }).state).toBe("help");
    expect(loneWorkStatus({ ...base, checks: [...help, at("resolved", 10 * H + 45 * M)], now: 11 * H }).state).toBe("ok");
  });
});
