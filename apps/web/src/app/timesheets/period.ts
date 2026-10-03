import { addDays, weekStart } from "@vicisrota/compliance";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Longest pay period, so a mistyped date cannot pull years of records. */
const MAX_DAYS = 62;

/** A pay period from query parameters, defaulting to the Monday-to-Sunday week containing `today`. */
export const parsePeriod = (from: string | null | undefined, to: string | null | undefined, today?: string) => {
  if (!from && !to && today) {
    const monday = weekStart(today);
    return { from: monday, to: addDays(monday, 6) };
  }
  if (!from || !to || !DATE.test(from) || !DATE.test(to)) return { error: "Choose a start and end date for the pay period." };
  if (to < from) return { error: "The end date must be on or after the start date." };
  if (to > addDays(from, MAX_DAYS - 1)) return { error: `A pay period can be at most ${MAX_DAYS} days.` };
  return { from, to };
};
