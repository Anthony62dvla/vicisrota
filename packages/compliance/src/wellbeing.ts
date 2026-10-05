import { isNightShift } from "./rules/fatigue";
import { HOUR } from "./time";
import type { Shift } from "./types";

/** A long shift for wellbeing check-ins: 10 hours or more. */
export const HARD_SHIFT_HOURS = 10;

/** Long shifts and night shifts are the ones people most often want a check-in after. */
export const isHardShift = (s: Pick<Shift, "id" | "workerId" | "start" | "end">) =>
  Date.parse(s.end) - Date.parse(s.start) >= HARD_SHIFT_HOURS * HOUR || isNightShift(s as Shift);

export type CheckInChoice = { on?: boolean; after?: "every" | "hard" };

/** How long after a shift ends the check-in is offered. After that it quietly goes away. */
export const CHECK_IN_HOURS = 24;

/** Whether to offer a check-in for a shift: only if the person turned them on, and only once it has ended. */
export const checkInDue = (choice: CheckInChoice, s: Pick<Shift, "id" | "workerId" | "start" | "end">, now: number) => {
  if (!choice.on) return false;
  const end = Date.parse(s.end);
  if (end > now || now - end > CHECK_IN_HOURS * HOUR) return false;
  return (choice.after ?? "hard") === "every" || isHardShift(s);
};
