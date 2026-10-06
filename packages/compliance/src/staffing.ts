import { addDays, londonDateTime, londonParts, MINUTE } from "./time";
import type { LocalDate } from "./types";

/**
 * A safe staffing level the business has set, such as "at least 3 people on Oak unit from 08:00 to 20:00"
 * or, for skill mix, "at least 1 Senior carer on at night". Care providers must deploy enough suitably
 * qualified staff at all times (Health and Social Care Act 2008 (Regulated Activities) Regulations 2014,
 * regulation 18).
 */
export interface StaffingLevel {
  id: string;
  /** Who it is for in words, e.g. "Oak unit" or "Whole business". */
  place: string;
  /** Only shifts at this workplace count. Null: shifts anywhere in the business count. */
  locationId: string | null;
  /** Only people working this job role count, for skill mix. Null: anyone counts. */
  roleId: string | null;
  roleName?: string | null;
  /** 1 = Monday to 7 = Sunday. */
  weekdays: number[];
  /** UK wall-clock "HH:MM". When to is the same as or earlier than from, the level runs past midnight. */
  from: string;
  to: string;
  minPeople: number;
  /** True: a rota that falls short cannot be published. False: it warns. */
  strict: boolean;
}

export interface StaffingShift {
  id: string;
  /** Open shifts nobody has taken do not count towards staffing. */
  workerId: string | null;
  locationId: string | null;
  roleId: string | null;
  start: string;
  end: string;
}

export interface StaffingGap {
  levelId: string;
  strict: boolean;
  /** The day the level starts on, even when the gap is after midnight. */
  date: LocalDate;
  /** Start and end of the gap, as instants (milliseconds). */
  from: number;
  to: number;
  /** How many people are on during the gap. */
  have: number;
  need: number;
  message: string;
}

export const STAFFING_LEGAL_REF =
  "Health and Social Care Act 2008 (Regulated Activities) Regulations 2014, reg. 18 (staffing). Your own safe staffing levels.";

const weekdayOf = (date: LocalDate) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

const hhmm = (t: number) => {
  const p = londonParts(t);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

const dayName = (date: LocalDate) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** The window a level covers on a given day, as instants. Handles levels that run past midnight. */
export const levelWindow = (level: Pick<StaffingLevel, "from" | "to">, date: LocalDate) => {
  const start = londonDateTime(date, level.from);
  const endsNextDay = level.to === "24:00" || level.to <= level.from;
  const end = level.to === "24:00" ? londonDateTime(addDays(date, 1), "00:00") : londonDateTime(endsNextDay ? addDays(date, 1) : date, level.to);
  return { start, end };
};

/**
 * Finds every stretch of time in the week where fewer people are on than a staffing level needs. A shift
 * counts towards a skill-mix level when it is for that role, or when it has no role and the person is set up
 * for the role.
 */
export function staffingGaps(opts: {
  levels: StaffingLevel[];
  shifts: StaffingShift[];
  weekStart: LocalDate;
  /** Job roles each person is set up for. */
  workerRoles?: Map<string, string[]> | undefined;
}): StaffingGap[] {
  const { levels, shifts, weekStart, workerRoles = new Map() } = opts;
  const gaps: StaffingGap[] = [];
  const staffed = shifts.filter((s) => s.workerId);
  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d);
    for (const level of levels) {
      if (!level.weekdays.includes(weekdayOf(date)) || level.minPeople < 1) continue;
      const { start, end } = levelWindow(level, date);
      const counting = staffed
        .filter((s) => level.locationId === null || s.locationId === level.locationId)
        .filter((s) => level.roleId === null || s.roleId === level.roleId || (s.roleId === null && (workerRoles.get(s.workerId!) ?? []).includes(level.roleId)))
        .map((s) => ({ worker: s.workerId!, from: Math.max(start, Date.parse(s.start)), to: Math.min(end, Date.parse(s.end)) }))
        .filter((s) => s.from < s.to);
      // Walk the window from one shift start or end to the next, counting different people on in each piece.
      const points = [...new Set([start, end, ...counting.flatMap((s) => [s.from, s.to])])].sort((a, b) => a - b);
      let open: { from: number; to: number; have: number } | null = null;
      for (let i = 0; i < points.length - 1; i++) {
        const [a, b] = [points[i]!, points[i + 1]!];
        const have = new Set(counting.filter((s) => s.from <= a && s.to >= b).map((s) => s.worker)).size;
        // Pieces are back to back, so a short piece with the same number on joins the gap before it.
        if (open && have === open.have) {
          open.to = b;
          continue;
        }
        if (open) gaps.push(gap(level, date, open));
        open = have < level.minPeople ? { from: a, to: b, have } : null;
      }
      if (open) gaps.push(gap(level, date, open));
    }
  }
  return gaps.sort((x, y) => x.from - y.from);
}

function gap(level: StaffingLevel, date: LocalDate, g: { from: number; to: number; have: number }): StaffingGap {
  const who = level.roleId ? `${level.roleName ?? "the role"}${level.minPeople === 1 ? "" : "s"}` : level.minPeople === 1 ? "person" : "people";
  const minutes = Math.round((g.to - g.from) / MINUTE);
  const length = minutes >= 60 ? `${+(minutes / 60).toFixed(1)} hours` : `${minutes} minutes`;
  return {
    levelId: level.id,
    strict: level.strict,
    date,
    from: g.from,
    to: g.to,
    have: g.have,
    need: level.minPeople,
    message: `${level.place} needs at least ${level.minPeople} ${who} on ${dayName(date)} from ${hhmm(g.from)} to ${hhmm(g.to)} (${length}), but ${g.have === 0 ? "nobody is" : `only ${g.have} ${g.have === 1 ? "is" : "are"}`} on the rota.`,
  };
}
