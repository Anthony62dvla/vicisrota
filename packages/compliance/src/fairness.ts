import { londonParts, ms, paidMillis } from "./time";
import type { Shift, Worker } from "./types";
import { nightHours } from "./workingTimeReport";

const HOUR = 3_600_000;

/** Short notice for a change or cancellation: less than a week, matching the rota's own notices. */
export const FAIRNESS_SHORT_NOTICE_HOURS = 7 * 24;

export interface FairnessLine {
  workerId: string;
  name: string;
  shifts: number;
  hours: number;
  weekendShifts: number;
  /** Shifts with at least 3 hours between 23:00 and 06:00, the legal test for night work. */
  nightShifts: number;
  /** Shifts the business cancelled or changed with less than a week's notice. */
  shortNoticeChanges: number;
  /** Plain notes where someone has a lot more than most of the team. Never a ranking. */
  notes: string[];
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Well above the team's typical number: at least 2 more, and half as many again (3 or more when most have none). */
const wellAbove = (value: number, typical: number) => (typical === 0 ? value >= 3 : value >= typical + 2 && value >= typical * 1.5);

/**
 * How weekends, nights and short-notice changes are shared out over a period, so a manager can spot one
 * person getting more than their share. People who worked no shifts are left out of the comparison.
 */
export const fairnessReport = (input: { workers: Worker[]; shifts: Shift[]; changes: { workerId: string; noticeHours: number }[] }): FairnessLine[] => {
  const lines = input.workers.map((w) => {
    const mine = input.shifts.filter((s) => s.workerId === w.id);
    return {
      workerId: w.id,
      name: w.name,
      shifts: mine.length,
      hours: Math.round((mine.reduce((sum, s) => sum + paidMillis(s), 0) / HOUR) * 10) / 10,
      weekendShifts: mine.filter((s) => [0, 6].includes(new Date(`${londonParts(ms(s.start)).date}T12:00:00Z`).getUTCDay())).length,
      nightShifts: mine.filter((s) => nightHours(s) >= 3).length,
      shortNoticeChanges: input.changes.filter((c) => c.workerId === w.id && c.noticeHours < FAIRNESS_SHORT_NOTICE_HOURS).length,
      notes: [] as string[],
    };
  });
  const working = lines.filter((l) => l.shifts > 0);
  if (working.length < 2) return lines;
  const typical = {
    weekendShifts: median(working.map((l) => l.weekendShifts)),
    nightShifts: median(working.map((l) => l.nightShifts)),
    shortNoticeChanges: median(working.map((l) => l.shortNoticeChanges)),
  };
  for (const l of working) {
    if (wellAbove(l.weekendShifts, typical.weekendShifts)) l.notes.push(`More weekend shifts than most of the team (most have ${typical.weekendShifts}).`);
    if (wellAbove(l.nightShifts, typical.nightShifts)) l.notes.push(`More night shifts than most of the team (most have ${typical.nightShifts}).`);
    if (wellAbove(l.shortNoticeChanges, typical.shortNoticeChanges))
      l.notes.push(`More short-notice changes than most of the team (most have ${typical.shortNoticeChanges}).`);
  }
  return lines;
};
