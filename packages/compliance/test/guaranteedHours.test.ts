import { describe, expect, it } from "vitest";
import { addDays, reviewGuaranteedHours } from "../src/index";

// Monday 12 October 2026: the reference period is 20 July to 11 October.
const today = "2026-10-14";
const weekly = (hours: number, weeks = 12) => Array.from({ length: weeks }, (_, i) => ({ date: addDays("2026-07-21", 7 * i), hours }));

describe("guaranteed hours", () => {
  it("averages the last 12 full weeks and suggests an offer above the contract", () => {
    const r = reviewGuaranteedHours(weekly(17.3), 0, today);
    expect(r).toMatchObject({ from: "2026-07-20", to: "2026-10-11", averageHours: 17.3, weeksWorked: 12, suggestedHours: 17, offerDue: true });
  });

  it("counts weeks with no work in the average", () => {
    expect(reviewGuaranteedHours(weekly(20, 6), 0, today)).toMatchObject({ averageHours: 10, weeksWorked: 6, suggestedHours: 10 });
  });

  it("does not suggest an offer when the contract already covers the hours", () => {
    expect(reviewGuaranteedHours(weekly(16), 16, today).offerDue).toBe(false);
  });

  it("ignores work outside the reference period", () => {
    expect(reviewGuaranteedHours([{ date: "2026-10-12", hours: 40 }, { date: "2026-07-19", hours: 40 }], 0, today).averageHours).toBe(0);
  });
});
