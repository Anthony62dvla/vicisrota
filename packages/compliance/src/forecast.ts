import { addDays } from "./time";
import type { LocalDate } from "./types";

/** How many earlier weeks of the same weekday a forecast looks at. */
export const FORECAST_WEEKS = 6;

/**
 * Expected sales for a day from the same weekday in earlier weeks: the average of the figures recorded,
 * with more recent weeks counting more. Needs at least 2 earlier figures, otherwise null.
 */
export const forecastSales = (history: { date: LocalDate; pence: number }[], date: LocalDate): number | null => {
  const byDate = new Map(history.map((h) => [h.date, h.pence]));
  let weighted = 0;
  let weights = 0;
  let points = 0;
  for (let i = 1; i <= FORECAST_WEEKS; i++) {
    const pence = byDate.get(addDays(date, -7 * i));
    if (pence === undefined) continue;
    const weight = FORECAST_WEEKS + 1 - i;
    weighted += pence * weight;
    weights += weight;
    points++;
  }
  return points >= 2 ? Math.round(weighted / weights) : null;
};

/** Paid hours the wage target allows for a day's sales, at the average hourly rate, to the nearest half hour below. */
export const affordableHours = (salesPence: number, targetPercent: number, averageRatePence: number): number =>
  averageRatePence > 0 ? Math.floor(((salesPence * targetPercent) / 100 / averageRatePence) * 2) / 2 : 0;
