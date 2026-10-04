/**
 * Statutory Sick Pay (Social Security Contributions and Benefits Act 1992, Part XI), as changed by the
 * Employment Rights Act 2025 from 6 April 2026: SSP is paid from the first qualifying day of sickness
 * (no waiting days, no four-day minimum), the lower earnings limit is gone, and the weekly amount is
 * the lower of the statutory rate and 80% of the person's average weekly earnings.
 *
 * Unchanged: SSP is paid only for qualifying days (the days the person normally works); spells of
 * sickness 56 days or less apart link into one period, which shares one 28-week limit and the average
 * earnings worked out at its start; a linked series stops paying after three years.
 *
 * A period of sickness that began before 6 April 2026 stays under the old rules (three waiting days,
 * lower earnings limit). VicisRota does not work those out and says so, so payroll can do it by hand.
 */
import { addDays } from "./time";
import type { LocalDate } from "./types";

export const SSP_REFORM_DATE: LocalDate = "2026-04-06";

/** Weekly rates by the date they apply from. A new rate each April is a new entry, never an edit. */
export const SSP_WEEKLY_RATES: { from: LocalDate; pence: number }[] = [{ from: "2026-04-06", pence: 12325 }];

/** Earnings replaced, from 6 April 2026: 80% of average weekly earnings, capped at the weekly rate. */
export const SSP_EARNINGS_SHARE = 0.8;
/** Spells this many days apart or fewer count as one period of sickness. */
export const SSP_LINK_DAYS = 56;
export const SSP_MAX_WEEKS = 28;
/** Fit note: an employer can ask for one after 7 calendar days off sick; before that the person self-certifies. */
export const SELF_CERTIFY_DAYS = 7;

export interface SicknessSpell {
  id: string;
  /** Whole UK dates, first and last day off sick, inclusive. */
  startsOn: LocalDate;
  endsOn: LocalDate;
  /**
   * Average weekly earnings over the 8 weeks before the period of sickness began, in pence.
   * Only the first spell of a linked period is used; later spells share it.
   */
  averageWeeklyEarningsPence: number;
}

export interface SspSpellResult {
  id: string;
  /** Days in the spell the person would normally have worked. */
  qualifyingDays: number;
  /** Qualifying days SSP is paid for. Fewer than qualifyingDays once the 28 weeks are used up. */
  paidDays: number;
  /** SSP for the spell, rounded to the nearest penny. */
  pence: number;
  /** The weekly amount used: the lower of the statutory rate and 80% of average weekly earnings. */
  weeklyPence: number;
  /** Joined onto an earlier spell 56 days or less before it. */
  linked: boolean;
  /** The id of the first spell of the linked period, whose average earnings apply. */
  periodStartId: string;
  /** Began, or links back to sickness that began, before 6 April 2026: the old rules apply, not worked out here. */
  oldRules: boolean;
  /** Longer than 7 calendar days, so the employer can ask for a fit note. */
  fitNoteNeeded: boolean;
  /** Weeks of the 28 still left at the end of this spell. */
  weeksLeft: number;
  /** The first day no more SSP is due, if the 28 weeks or the three years ran out in this spell. */
  exhaustedOn?: LocalDate;
}

export interface SspDay {
  date: LocalDate;
  spellId: string;
  /** Unrounded, so totals over a pay period can be rounded once. */
  pence: number;
}

export const sspWeeklyRate = (date: LocalDate) =>
  [...SSP_WEEKLY_RATES].reverse().find((r) => r.from <= date)?.pence ?? null;

/** 0 = Sunday ... 6 = Saturday, for a whole UK date. */
export const weekdayOf = (date: LocalDate) => new Date(`${date}T12:00:00Z`).getUTCDay();

const daysBetween = (a: LocalDate, b: LocalDate) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

const addYears = (date: LocalDate, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

/**
 * Works out SSP for one person's spells of sickness.
 * qualifyingWeekdays are the days of the week they normally work (0 = Sunday); with none, nothing is paid.
 */
export function statutorySickPay(
  spells: SicknessSpell[],
  qualifyingWeekdays: number[],
): { spells: SspSpellResult[]; days: SspDay[] } {
  const qualifying = new Set(qualifyingWeekdays);
  const perWeek = qualifying.size;
  const sorted = [...spells].sort((a, b) => (a.startsOn < b.startsOn ? -1 : a.startsOn > b.startsOn ? 1 : 0));
  const results: SspSpellResult[] = [];
  const days: SspDay[] = [];

  let period: { start: SicknessSpell; lastDay: LocalDate; weeksUsed: number; oldRules: boolean } | null = null;
  for (const spell of sorted) {
    const linked = period !== null && daysBetween(period.lastDay, spell.startsOn) - 1 <= SSP_LINK_DAYS;
    if (!linked || !period) period = { start: spell, lastDay: spell.endsOn, weeksUsed: 0, oldRules: spell.startsOn < SSP_REFORM_DATE };
    const current = period;
    if (spell.endsOn > current.lastDay) current.lastDay = spell.endsOn;
    const earningsCap = Math.max(0, current.start.averageWeeklyEarningsPence) * SSP_EARNINGS_SHARE;
    const stopsOn = addYears(current.start.startsOn, 3);

    let qualifyingDays = 0;
    let paidDays = 0;
    let pence = 0;
    let weeklyPence = 0;
    let exhaustedOn: LocalDate | undefined;
    for (let d = spell.startsOn; d <= spell.endsOn; d = addDays(d, 1)) {
      if (!qualifying.has(weekdayOf(d))) continue;
      qualifyingDays++;
      if (current.oldRules) continue;
      const rate = sspWeeklyRate(d);
      if (rate === null) continue;
      if (current.weeksUsed >= SSP_MAX_WEEKS - 1e-9 || d >= stopsOn) {
        exhaustedOn ??= d;
        continue;
      }
      weeklyPence = Math.min(rate, earningsCap);
      const dayPence = weeklyPence / perWeek;
      current.weeksUsed += 1 / perWeek;
      paidDays++;
      pence += dayPence;
      if (dayPence > 0) days.push({ date: d, spellId: spell.id, pence: dayPence });
    }
    if (!weeklyPence && !current.oldRules) weeklyPence = Math.min(sspWeeklyRate(spell.startsOn) ?? 0, earningsCap);

    results.push({
      id: spell.id,
      qualifyingDays,
      paidDays,
      pence: Math.round(pence),
      weeklyPence: Math.round(weeklyPence),
      linked,
      periodStartId: current.start.id,
      oldRules: current.oldRules,
      fitNoteNeeded: daysBetween(spell.startsOn, spell.endsOn) + 1 > SELF_CERTIFY_DAYS,
      weeksLeft: Math.max(0, Math.round((SSP_MAX_WEEKS - current.weeksUsed) * 10) / 10),
      ...(exhaustedOn ? { exhaustedOn } : {}),
    });
  }
  return { spells: results, days };
}

/** SSP due for days inside a pay period, rounded once to the nearest penny. */
export const sspInPeriod = (days: SspDay[], from: LocalDate, to: LocalDate) =>
  Math.round(days.filter((d) => d.date >= from && d.date <= to).reduce((s, d) => s + d.pence, 0));

/**
 * The days of the week someone normally works, from the shifts they actually had. Falls back to
 * Monday to Friday when they had none. Pages show which days were used, so a manager can check them.
 */
export const usualWorkingWeekdays = (shiftDates: LocalDate[]) => {
  const seen = [...new Set(shiftDates.map(weekdayOf))].sort();
  return seen.length ? seen : [1, 2, 3, 4, 5];
};
