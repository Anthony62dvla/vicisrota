import { describe, expect, it } from "vitest";
import { weekCost } from "../src/index";

const rates = [
  { workerId: "jo", hourlyPence: 1250, effectiveFrom: "2026-01-01" },
  { workerId: "jo", hourlyPence: 1300, effectiveFrom: "2026-10-07" },
];

describe("planned hours and wages", () => {
  it("takes off unpaid breaks and uses the rate in force on each day", () => {
    const cost = weekCost(
      [
        // Tuesday 6 October: 8 hours less a 30 minute break, at £12.50.
        { id: "a", workerId: "jo", start: "2026-10-06T09:00:00+01:00", end: "2026-10-06T17:00:00+01:00", breaks: [{ start: "2026-10-06T12:00:00+01:00", end: "2026-10-06T12:30:00+01:00" }] },
        // Wednesday 7 October: 4 hours at the new £13.00 rate.
        { id: "b", workerId: "jo", start: "2026-10-07T09:00:00+01:00", end: "2026-10-07T13:00:00+01:00" },
      ],
      rates,
    );
    expect(cost.byWorker.get("jo")).toEqual({ hours: 11.5, pence: 7.5 * 1250 + 4 * 1300 });
    expect(cost).toMatchObject({ hours: 11.5, pence: 14575, openHours: 0, missingRate: [] });
  });

  it("counts open shifts and missing pay rates separately instead of guessing", () => {
    const cost = weekCost(
      [
        { id: "open", workerId: null, start: "2026-10-06T18:00:00+01:00", end: "2026-10-06T22:00:00+01:00" },
        { id: "new", workerId: "sam", start: "2026-10-06T09:00:00+01:00", end: "2026-10-06T12:00:00+01:00" },
      ],
      rates,
    );
    expect(cost).toMatchObject({ hours: 3, pence: 0, openHours: 4, missingRate: ["sam"] });
  });

  it("adds paid travel between care visits only when the business pays it", () => {
    const visit = { id: "v", workerId: "jo", start: "2026-10-06T09:00:00+01:00", end: "2026-10-06T10:00:00+01:00", travelMinutesBefore: 30 };
    expect(weekCost([visit], rates).hours).toBe(1);
    expect(weekCost([visit], rates, { paysTravelTime: true }).hours).toBe(1.5);
  });
});
