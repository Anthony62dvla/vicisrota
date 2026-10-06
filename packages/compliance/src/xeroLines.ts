import { londonParts } from "./time";
import type { Instant, LocalDate } from "./types";

/**
 * Confirmed hours per UK day, for payroll software that takes daily timesheet lines. A sleep-in counts only the
 * time woken to work, since the rest is paid as the sleep-in payment. Hours are rounded to 2 decimal places.
 */
export const dailyHours = (entries: { start: Instant; end: Instant; breakMinutes: number; sleepIn?: boolean; awakeMinutes?: number }[]): { date: LocalDate; hours: number }[] => {
  const byDay = new Map<LocalDate, number>();
  for (const e of entries) {
    const minutes = e.sleepIn ? (e.awakeMinutes ?? 0) : (Date.parse(e.end) - Date.parse(e.start)) / 60_000 - e.breakMinutes;
    if (minutes <= 0) continue;
    const date = londonParts(Date.parse(e.start)).date;
    byDay.set(date, (byDay.get(date) ?? 0) + minutes);
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, minutes]) => ({ date, hours: Math.round((minutes / 60) * 100) / 100 }));
};

/** Matches staff to payroll employees: by the payroll ID first, then by an exact, unique full name. */
export const matchEmployees = <E extends { id: string; name: string }>(staff: { id: string; name: string; payrollId: string | null }[], employees: E[]) => {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return new Map(
    staff.flatMap((s) => {
      const byId = s.payrollId ? employees.find((e) => e.id === s.payrollId) : undefined;
      if (byId) return [[s.id, byId] as const];
      const byName = employees.filter((e) => norm(e.name) === norm(s.name));
      return byName.length === 1 ? [[s.id, byName[0]!] as const] : [];
    }),
  );
};
