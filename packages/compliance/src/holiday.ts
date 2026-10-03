/** Irregular-hours and part-year workers accrue 12.07% of hours worked (leave years from 1 April 2024). */
export const IRREGULAR_HOURS_ACCRUAL_RATE = 0.1207;

export const irregularHoursAccrual = (hoursWorkedInPayPeriod: number): number =>
  Math.round(hoursWorkedInPayPeriod * IRREGULAR_HOURS_ACCRUAL_RATE * 100) / 100;

/** Statutory annual leave in days for a regular week: 5.6 weeks, capped at 28 days. */
export const statutoryAnnualLeaveDays = (daysWorkedPerWeek: number): number =>
  Math.min(28, Math.round(daysWorkedPerWeek * 5.6 * 100) / 100);

/** The leave year containing a date, for a leave year that starts on the 1st of startMonth (1 = January). */
export const leaveYear = (date: string, startMonth = 1): { start: string; end: string } => {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const startYear = m >= startMonth ? y : y - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${startYear}-${pad(startMonth)}-01`;
  const next = `${startYear + 1}-${pad(startMonth)}-01`;
  const end = new Date(Date.parse(`${next}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return { start, end };
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Statutory leave for a leave year, in days. Someone who starts part-way through the year gets
 * a share in proportion to the time left, rounded up to the next half day (never rounded down).
 */
export const annualEntitlementDays = (opts: {
  daysWorkedPerWeek: number;
  year: { start: string; end: string };
  employmentStart?: string | null;
}): number => {
  const full = statutoryAnnualLeaveDays(opts.daysWorkedPerWeek);
  const { start, end } = opts.year;
  if (!opts.employmentStart || opts.employmentStart <= start) return full;
  if (opts.employmentStart > end) return 0;
  const share = (daysBetween(opts.employmentStart, end) + 1) / (daysBetween(start, end) + 1);
  return Math.min(full, Math.ceil(full * share * 2) / 2);
};
