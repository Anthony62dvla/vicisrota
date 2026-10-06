import { describe, expect, it } from "vitest";
import { affordableHours, forecastSales } from "../src/index";

describe("demand forecasting", () => {
  it("weights recent weeks of the same weekday more", () => {
    // Fridays: last week £1,200, two weeks ago £900.
    const history = [
      { date: "2026-10-09", pence: 120_000 },
      { date: "2026-10-02", pence: 90_000 },
      { date: "2026-10-08", pence: 5_000 },
    ];
    expect(forecastSales(history, "2026-10-16")).toBe(Math.round((120_000 * 6 + 90_000 * 5) / 11));
  });

  it("needs at least two earlier figures", () => {
    expect(forecastSales([{ date: "2026-10-09", pence: 120_000 }], "2026-10-16")).toBeNull();
  });

  it("ignores figures older than 6 weeks", () => {
    expect(forecastSales([{ date: "2026-08-28", pence: 1 }, { date: "2026-08-21", pence: 1 }], "2026-10-16")).toBeNull();
  });

  it("works out the hours a wage target allows", () => {
    // £1,000 sales at 25% is £250 of wages; at £12.71 an hour that is 19.67 hours, so 19.5.
    expect(affordableHours(100_000, 25, 1_271)).toBe(19.5);
    expect(affordableHours(100_000, 25, 0)).toBe(0);
  });
});
