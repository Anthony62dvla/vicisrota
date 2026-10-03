/**
 * Clocking in and out. Times are kept to the minute they happened and never rounded: rounding in the
 * employer's favour can take pay below the National Minimum Wage, which is calculated on time
 * actually worked (National Minimum Wage Regulations 2015, Part 5).
 */

export type ClockKind = "in" | "break_start" | "break_end" | "out";

export interface ClockEvent {
  kind: ClockKind;
  at: number;
}

export type ClockState = "not_in" | "in" | "on_break" | "out";

export interface ClockSummary {
  state: ClockState;
  clockedIn: number | null;
  clockedOut: number | null;
  /** Whole minutes on break, counting a break still running up to `now`. */
  breakMinutes: number;
  /** Positive when the person clocked in after the rostered start. */
  lateMinutes: number;
  /** Positive when the person clocked out before the rostered end. */
  leftEarlyMinutes: number;
  /** Positive when the person clocked out after the rostered end. */
  stayedLateMinutes: number;
}

const MIN = 60_000;

/** What the person can do next, so the screen only offers buttons that make sense. */
export const nextClockActions = (state: ClockState): ClockKind[] =>
  ({ not_in: ["in"], in: ["break_start", "out"], on_break: ["break_end"], out: [] })[state] as ClockKind[];

export const clockSummary = (events: ClockEvent[], shift: { start: number; end: number }, now: number): ClockSummary => {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  let state: ClockState = "not_in";
  let clockedIn: number | null = null;
  let clockedOut: number | null = null;
  let breakMs = 0;
  let breakFrom: number | null = null;
  for (const e of sorted) {
    // Events that make no sense in the current state are ignored rather than trusted.
    if (!nextClockActions(state).includes(e.kind)) continue;
    if (e.kind === "in") (clockedIn = e.at), (state = "in");
    if (e.kind === "break_start") (breakFrom = e.at), (state = "on_break");
    if (e.kind === "break_end") (breakMs += e.at - breakFrom!), (breakFrom = null), (state = "in");
    if (e.kind === "out") (clockedOut = e.at), (state = "out");
  }
  if (breakFrom !== null) breakMs += now - breakFrom;
  const mins = (ms: number) => Math.max(0, Math.round(ms / MIN));
  return {
    state,
    clockedIn,
    clockedOut,
    breakMinutes: Math.floor(breakMs / MIN),
    lateMinutes: clockedIn === null ? 0 : mins(clockedIn - shift.start),
    leftEarlyMinutes: clockedOut === null ? 0 : mins(shift.end - clockedOut),
    stayedLateMinutes: clockedOut === null ? 0 : mins(clockedOut - shift.end),
  };
};
