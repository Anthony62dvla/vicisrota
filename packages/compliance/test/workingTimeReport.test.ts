import { describe, expect, it } from "vitest";
import { addDays, nightHours, referencePeriod, workingTimeReport } from "../src/index";

const today = "2026-10-04"; // Sunday
const adult = { id: "jo", name: "Jo", dateOfBirth: "1990-01-01" };
/** A shift on the given day, 09:00 to 09:00 + hours, UK summer time. */
const day = (workerId: string, date: string, hours: number, id = `${workerId}-${date}`) => {
  const end = new Date(Date.parse(`${date}T08:00:00Z`) + hours * 3_600_000).toISOString();
  return { id, workerId, start: `${date}T08:00:00Z`, end };
};
/** Every weekday of the 17 weeks, `hours` a day. */
const everyWeekday = (workerId: string, hours: number) => {
  const { from } = referencePeriod(today);
  return Array.from({ length: 17 * 7 }, (_, i) => addDays(from, i))
    .filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()))
    .map((d) => day(workerId, d, hours));
};

describe("working time records", () => {
  it("uses the 17 whole weeks before this week", () => {
    expect(referencePeriod(today)).toEqual({ from: "2026-06-01", to: "2026-09-27" });
  });

  it("averages hours over 17 weeks and flags someone over 48 who has not opted out", () => {
    const [line] = workingTimeReport({ today, workers: [adult], worked: everyWeekday("jo", 10), leave: [] });
    expect(line).toMatchObject({ totalHours: 850, averageHours: 50, highestWeekHours: 50, status: "over", weeks: expect.any(Array) });
    expect(line!.weeks).toHaveLength(17);
  });

  it("flags an average close to the limit, and shows opted-out people without a limit", () => {
    const [close] = workingTimeReport({ today, workers: [adult], worked: everyWeekday("jo", 9), leave: [] });
    expect(close).toMatchObject({ averageHours: 45, status: "close" });
    const [opted] = workingTimeReport({ today, workers: [{ ...adult, optedOutOf48HourLimit: true }], worked: everyWeekday("jo", 10), leave: [] });
    expect(opted).toMatchObject({ averageHours: 50, status: "opted_out" });
  });

  it("leaves holiday and sickness out so they do not pull the average down", () => {
    // 8 hours a day, but two whole weeks of holiday (Mon 3 to Fri 14 August) when nothing was worked.
    const worked = everyWeekday("jo", 8).filter((s) => s.start < "2026-08-03" || s.start >= "2026-08-15");
    const leave = [{ workerId: "jo", kind: "annual" as const, status: "approved" as const, startsOn: "2026-08-03", endsOn: "2026-08-14" }];
    const [withLeave] = workingTimeReport({ today, workers: [adult], worked, leave });
    expect(withLeave).toMatchObject({ excludedWeeks: 2, averageHours: 40 });
    // Without the leave recorded, the average would wrongly look lower.
    const [without] = workingTimeReport({ today, workers: [adult], worked, leave: [] });
    expect(without!.averageHours).toBeCloseTo(35.3, 1);
  });

  it("checks under-18s against 40 hours in every week, whatever the average", () => {
    const young = { id: "sam", name: "Sam", dateOfBirth: "2009-06-01", optedOutOf48HourLimit: true };
    const worked = [...everyWeekday("sam", 6), day("sam", "2026-09-26", 12)]; // one 42-hour week
    const [line] = workingTimeReport({ today, workers: [young], worked, leave: [] });
    expect(line).toMatchObject({ young: true, optedOut: false, weeksOverYoungLimit: 1, status: "over" });
  });

  it("says when there are no hours, and ignores work outside the period", () => {
    const [line] = workingTimeReport({ today, workers: [adult], worked: [day("jo", "2026-09-29", 8)], leave: [] });
    expect(line).toMatchObject({ totalHours: 0, averageHours: null, status: "no_hours" });
  });

  it("counts night hours between 23:00 and 06:00 UK time", () => {
    expect(nightHours({ id: "n", workerId: "jo", start: "2026-10-01T21:00:00Z", end: "2026-10-02T07:00:00Z" })).toBe(7);
    expect(nightHours(day("jo", "2026-10-01", 8))).toBe(0);
  });
});
