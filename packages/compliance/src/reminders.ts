/**
 * Shift reminders that each person chooses for themselves: the evening before, a set time before,
 * or both. Knowing what is coming, without having to remember to check, is one of the simplest ways
 * to make work more predictable.
 */
import { addDays, londonDateTime, londonParts } from "./time";

/** Evening-before reminders go out from this time, UK time. */
export const EVENING_REMINDER_TIME = "18:00";
/** Evening reminders are not sent after this, so nobody is texted late at night because a check ran late. */
export const EVENING_REMINDER_LAST = "21:00";
export const BEFORE_CHOICES = [30, 60, 120] as const;
/** A reminder that could not go out on time is dropped after this long rather than sent late. */
const LATE_ALLOWANCE_MS = 30 * 60_000;

export type ReminderChoice = { evening?: boolean; beforeMinutes?: number | null };
export type DueReminder = { kind: "evening" | "before"; key: string };

/** Reminders due now for one shift, each with a key so it is only ever sent once. */
export const remindersDue = (choice: ReminderChoice, shift: { id: string; start: number }, now: number): DueReminder[] => {
  const due: DueReminder[] = [];
  if (now >= shift.start) return due;
  if (choice.evening) {
    const dayBefore = addDays(londonParts(shift.start).date, -1);
    const from = londonDateTime(dayBefore, EVENING_REMINDER_TIME);
    const until = londonDateTime(dayBefore, EVENING_REMINDER_LAST);
    if (now >= from && now < until) due.push({ kind: "evening", key: `remind-evening:${shift.id}` });
  }
  const before = choice.beforeMinutes;
  if (before && (BEFORE_CHOICES as readonly number[]).includes(before)) {
    const at = shift.start - before * 60_000;
    if (now >= at && now < at + LATE_ALLOWANCE_MS) due.push({ kind: "before", key: `remind-${before}:${shift.id}` });
  }
  return due;
};
