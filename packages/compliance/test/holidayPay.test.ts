import { describe, expect, it } from "vitest";
import { addDays, holidayPayFor, holidayPayRate, weeklyPay, type PayWeek } from "../src";

const weeks = (n: number, pence: number, hours: number, from = "2025-10-06"): PayWeek[] =>
  Array.from({ length: n }, (_, i) => ({ weekStart: addDays(from, i * 7), pence, hours }));

describe("holiday pay on a 52-week average", () => {
  it("averages the last 52 paid weeks before the holiday", () => {
    // 40 weeks at £500, then 20 more recent weeks at £600: the 52 newest are 32 x £500 + 20 x £600.
    const history = [...weeks(40, 50_000, 40, "2025-01-06"), ...weeks(20, 60_000, 40, addDays("2025-01-06", 40 * 7))];
    const rate = holidayPayRate(history, addDays("2025-01-06", 60 * 7))!;
    expect(rate.weeksUsed).toBe(52);
    expect(rate.weekPence).toBe(Math.round((32 * 50_000 + 20 * 60_000) / 52));
  });

  it("skips weeks with no pay and uses fewer weeks for newer starters", () => {
    const history = [...weeks(3, 40_000, 30), { weekStart: addDays("2025-10-06", 21), pence: 0, hours: 0 }, ...weeks(2, 20_000, 15, addDays("2025-10-06", 28))];
    const rate = holidayPayRate(history, "2025-11-24")!;
    expect(rate).toEqual({ weeksUsed: 5, weekPence: 32_000, hourPence: Math.round(160_000 / 120) });
  });

  it("ignores pay from the week the holiday starts, and from more than 104 weeks back", () => {
    expect(holidayPayRate(weeks(1, 50_000, 40, "2026-10-05"), "2026-10-07")).toBeNull();
    expect(holidayPayRate(weeks(1, 50_000, 40, "2024-01-01"), "2026-10-07")).toBeNull();
  });

  it("pays days as a share of a week's pay, and hours at the hourly average", () => {
    const rate = { weeksUsed: 52, weekPence: 50_000, hourPence: 1_250 };
    expect(holidayPayFor(rate, { days: 2 }, 5)).toBe(20_000);
    expect(holidayPayFor(rate, { days: 1 }, 4)).toBe(12_500);
    expect(holidayPayFor(rate, { hours: 7.5 }, 5)).toBe(9_375);
  });

  it("works out each week's pay from confirmed hours", () => {
    const pay = weeklyPay({
      workers: [{ id: "w", name: "Jo", dateOfBirth: "1990-01-01" }],
      entries: [
        { id: "a", workerId: "w", start: "2026-09-07T08:00:00Z", end: "2026-09-07T16:00:00Z", breaks: [] },
        { id: "b", workerId: "w", start: "2026-09-15T08:00:00Z", end: "2026-09-15T12:00:00Z", breaks: [] },
      ],
      payRates: [{ workerId: "w", hourlyPence: 1_300, effectiveFrom: "2026-04-01" }],
    }).get("w")!;
    expect(pay).toEqual([
      { weekStart: "2026-09-07", pence: 10_400, hours: 8 },
      { weekStart: "2026-09-14", pence: 5_200, hours: 4 },
    ]);
  });
});
