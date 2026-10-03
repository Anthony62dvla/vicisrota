/** Irregular-hours and part-year workers accrue 12.07% of hours worked (leave years from 1 April 2024). */
export const IRREGULAR_HOURS_ACCRUAL_RATE = 0.1207;

export const irregularHoursAccrual = (hoursWorkedInPayPeriod: number): number =>
  Math.round(hoursWorkedInPayPeriod * IRREGULAR_HOURS_ACCRUAL_RATE * 100) / 100;

/** Statutory annual leave in days for a regular week: 5.6 weeks, capped at 28 days. */
export const statutoryAnnualLeaveDays = (daysWorkedPerWeek: number): number =>
  Math.min(28, Math.round(daysWorkedPerWeek * 5.6 * 100) / 100);
