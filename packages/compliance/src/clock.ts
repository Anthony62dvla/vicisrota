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

export interface Workplace {
  id: string;
  latitude: number;
  longitude: number;
  /** How close counts as "at work", in metres. */
  radiusMetres: number;
}

/** Straight-line distance between two points on the Earth, in metres (haversine). */
export const distanceMetres = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Phone locations can be off by tens of metres indoors, so up to this much of the reported accuracy is allowed for. */
export const MAX_ACCURACY_ALLOWANCE_METRES = 100;

/**
 * Where a phone was when someone clocked in, relative to the nearest workplace. Only the distance is
 * kept, not the coordinates, so the business learns "at work or not" and nothing more about where
 * the person was.
 */
export const placeCheck = (position: { latitude: number; longitude: number; accuracyMetres: number }, workplaces: Workplace[]) => {
  if (!workplaces.length) return null;
  const nearest = workplaces
    .map((w) => ({ workplace: w, distance: distanceMetres(position, w) }))
    .sort((a, b) => a.distance - b.distance)[0]!;
  const allowance = Math.min(Math.max(position.accuracyMetres, 0), MAX_ACCURACY_ALLOWANCE_METRES);
  return {
    workplaceId: nearest.workplace.id,
    distanceMetres: Math.round(nearest.distance),
    within: nearest.distance <= nearest.workplace.radiusMetres + allowance,
  };
};

/** Someone is "starting now" rather than late for the first few minutes of a shift. */
export const LATE_GRACE_MINUTES = 5;

export type AttendanceState = "upcoming" | "starting" | "late" | "missed" | "in" | "on_break" | "finished" | "on_leave";

/**
 * Where someone is with a rostered shift, for the "Today" board and late alerts. Only a clock-in
 * counts as arriving, so this is only meaningful for businesses whose staff clock in.
 */
export const attendance = (summary: ClockSummary, shift: { start: number; end: number }, now: number, onLeave = false) => {
  const minutesLate = summary.state === "not_in" ? Math.max(0, Math.floor((Math.min(now, shift.end) - shift.start) / MIN)) : summary.lateMinutes;
  let state: AttendanceState;
  if (summary.state === "in") state = "in";
  else if (summary.state === "on_break") state = "on_break";
  else if (summary.state === "out") state = "finished";
  // Approved leave or sickness explains an empty clock; clocking in anyway still shows above.
  else if (onLeave) state = "on_leave";
  else if (now < shift.start) state = "upcoming";
  else if (now >= shift.end) state = "missed";
  else state = minutesLate < LATE_GRACE_MINUTES ? "starting" : "late";
  return { state, minutesLate };
};

/** Late alerts go out for this long after a shift ends, so turning alerts on does not text about old shifts. */
export const LATE_ALERT_WINDOW_AFTER_END_MINUTES = 30;

/**
 * Whether the alert contacts should be told nobody has clocked in: `afterMinutes` past the start
 * (or at the end, for a shift shorter than that), and not long after it ended.
 */
export const lateAlertDue = (state: AttendanceState, shift: { start: number; end: number }, now: number, afterMinutes: number) =>
  (state === "late" || state === "missed") &&
  now >= Math.min(shift.start + afterMinutes * MIN, shift.end) &&
  now < shift.end + LATE_ALERT_WINDOW_AFTER_END_MINUTES * MIN;
