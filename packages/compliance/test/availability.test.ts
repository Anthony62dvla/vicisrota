import { describe, expect, it } from "vitest";
import { agreedAdjustments, evaluate, unavailableTimes, type Context, type Worker } from "../src/index";

const rtw = [{ kind: "right_to_work" as const, checkedOn: "2026-01-05" }];
const jo: Worker = { id: "jo", name: "Jo", dateOfBirth: "1990-05-01", checks: rtw };
// Monday 5 October 2026 is in BST (UTC+1).
const shift = (id: string, start: string, end: string) => ({ id, workerId: "jo", start: `${start}+01:00`, end: `${end}+01:00` });
const ctx = (worker: Worker, shifts: ReturnType<typeof shift>[]): Context => ({
  asOf: "2026-10-01",
  workers: [worker],
  shifts,
  payRates: [{ workerId: "jo", hourlyPence: 1300, effectiveFrom: "2026-04-01" }],
});

describe("times someone cannot work", () => {
  const school = { ...jo, unavailable: [{ weekday: 1, from: "15:00", to: "17:00" }, { weekday: 6, from: "00:00", to: "24:00" }] };

  it("warns when a shift overlaps, but does not block", () => {
    const found = unavailableTimes.check(ctx(school, [shift("mon", "2026-10-05T12:00:00", "2026-10-05T16:00:00")]));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: "warn", message: expect.stringContaining("Mondays from 15:00 to 17:00") });
    expect(evaluate(ctx(school, [shift("mon", "2026-10-05T12:00:00", "2026-10-05T16:00:00")])).publishable).toBe(true);
  });

  it("allows shifts that only touch the edges or fall on other days", () => {
    expect(unavailableTimes.check(ctx(school, [shift("a", "2026-10-05T09:00:00", "2026-10-05T15:00:00"), shift("b", "2026-10-05T17:00:00", "2026-10-05T21:00:00"), shift("c", "2026-10-06T15:00:00", "2026-10-06T17:00:00")]))).toEqual([]);
  });

  it("catches an overnight shift running into a whole day off", () => {
    // Friday 22:00 to Saturday 06:00, and Saturday is unavailable all day.
    expect(unavailableTimes.check(ctx(school, [shift("fri", "2026-10-09T22:00:00", "2026-10-10T06:00:00")]))).toHaveLength(1);
  });
});

describe("agreed adjustments", () => {
  const adjusted = { ...jo, adjustments: { maxShiftHours: 6, earliestStart: "09:00", latestFinish: "20:00" } };

  it("says which adjustment a shift breaks", () => {
    const found = agreedAdjustments.check(ctx(adjusted, [shift("long", "2026-10-05T08:00:00", "2026-10-05T16:00:00")]));
    expect(found.map((f) => f.message)).toEqual([
      "Jo has an agreed adjustment: shifts no longer than 6 hours, and this one is 8 hours. Change the shift, or talk to them first.",
      "Jo has an agreed adjustment: starting no earlier than 09:00, and this one starts at 08:00. Change the shift, or talk to them first.",
    ]);
    expect(found[0]).toMatchObject({ severity: "warn", legalRef: expect.stringContaining("Equality Act 2010") });
  });

  it("treats finishing after midnight as a late finish", () => {
    const found = agreedAdjustments.check(ctx(adjusted, [shift("late", "2026-10-05T18:00:00", "2026-10-06T00:30:00")]));
    expect(found.map((f) => f.evidence)).toContainEqual({ latestFinish: "20:00", finishes: "00:30" });
  });

  it("is quiet when the shift fits", () => {
    expect(agreedAdjustments.check(ctx(adjusted, [shift("ok", "2026-10-05T10:00:00", "2026-10-05T16:00:00")]))).toEqual([]);
    expect(agreedAdjustments.check(ctx(jo, [shift("none", "2026-10-05T06:00:00", "2026-10-05T23:00:00")]))).toEqual([]);
  });
});
