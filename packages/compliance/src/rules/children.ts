import { addDays, ageOn, fmtHours, HOUR, londonDateTime, londonParts, longestBreakMillis, ms, shiftsByWorker, weekStart, workedMillis } from "../time";
import type { Finding, LocalDate, Rule, Shift, Worker } from "../types";

export const CHILD_LEGAL_REF =
  "Children and Young Persons Act 1933, ss 18 and 21, as amended by the Children (Protection at Work) Regulations 1998, and your council's byelaws on child employment";

/** The last Friday in June of the school year in which the child turns 16 (England and Wales). */
export const schoolLeavingDate = (dateOfBirth: LocalDate): LocalDate => {
  const [y, m] = dateOfBirth.split("-").map(Number) as [number, number];
  const year = y + 16 + (m >= 9 ? 1 : 0);
  const june30 = new Date(Date.UTC(year, 5, 30));
  const back = (june30.getUTCDay() - 5 + 7) % 7;
  return new Date(Date.UTC(year, 5, 30 - back)).toISOString().slice(0, 10);
};

/** Below school leaving age on this date: the child employment rules apply. */
export const isSchoolAge = (dateOfBirth: LocalDate, on: LocalDate) => on < schoolLeavingDate(dateOfBirth);

const fmtDate = (d: LocalDate) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/**
 * Children of school age can only do light work, with a council work permit, between 7am and 7pm, and within daily
 * and weekly limits. School term dates are not known, so limits that only apply in term time are warnings.
 */
export const childEmployment: Rule = {
  id: "children.employment",
  version: 1,
  title: "Children of school age",
  legalRef: CHILD_LEGAL_REF,
  effectiveFrom: "1998-08-04",
  check(ctx) {
    const workers = new Map(ctx.workers.map((w) => [w.id, w]));
    const out: Finding[] = [];
    for (const [workerId, shifts] of shiftsByWorker(ctx.shifts)) {
      const w = workers.get(workerId);
      if (!w) continue;
      const mine = shifts.filter((s) => isSchoolAge(w.dateOfBirth, londonParts(ms(s.start)).date));
      if (!mine.length) continue;
      const find = (severity: "block" | "warn", s: Shift[], message: string, evidence: Finding["evidence"] = {}): Finding => ({
        ruleId: this.id,
        ruleVersion: this.version,
        severity,
        workerId,
        shiftIds: s.map((x) => x.id),
        message,
        evidence,
        legalRef: this.legalRef,
      });
      const days = new Map<LocalDate, Shift[]>();
      for (const s of mine) {
        const d = londonParts(ms(s.start)).date;
        days.set(d, [...(days.get(d) ?? []), s]);
      }
      for (const [d, list] of days) {
        const age = ageOn(w.dateOfBirth, d);
        const under15 = age < 15;
        if (age < 13) {
          out.push(find("block", list, `${w.name} is ${age}. Children under 13 cannot be employed.`, { age }));
          continue;
        }
        const permit = w.childWorkPermit;
        if (!permit || (permit.expiresOn && permit.expiresOn < d))
          out.push(find("block", list, `${w.name} is of school age and needs a work permit from the council before working on ${fmtDate(d)}. Record it on their staff record.`, { age }));
        const early = londonDateTime(d, "07:00");
        const late = londonDateTime(d, "19:00");
        for (const s of list) {
          if (ms(s.start) < early || ms(s.end) > late) out.push(find("block", [s], `${w.name} is of school age and can only work between 7am and 7pm.`, { age }));
          if (workedMillis(s) > 4 * HOUR && longestBreakMillis(s) < HOUR) out.push(find("block", [s], `${w.name} is of school age and needs a 1-hour break after 4 hours of work.`, { age }));
        }
        const total = list.reduce((t, s) => t + workedMillis(s), 0);
        const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
        const dayMax = weekday === 0 ? 2 : under15 ? 5 : 8;
        if (total > dayMax * HOUR)
          out.push(find("block", list, `${w.name} is of school age and can work at most ${dayMax} hours on a ${weekday === 0 ? "Sunday" : "day"}. This day has ${fmtHours(total)}.`, { age, hours: total / HOUR }));
        else if (weekday >= 1 && weekday <= 5) {
          const inSchool = list.some((s) => ms(s.start) < londonDateTime(d, "15:30") && ms(s.end) > londonDateTime(d, "08:45"));
          if (total > 2 * HOUR || inSchool)
            out.push(find("warn", list, `${w.name} is of school age. On a school day they can work at most 2 hours, and never in school hours. Only keep this if ${fmtDate(d)} is in the school holidays.`, { age }));
        }
      }
      const weeks = new Map<LocalDate, Shift[]>();
      for (const s of mine) {
        const wk = weekStart(londonParts(ms(s.start)).date);
        weeks.set(wk, [...(weeks.get(wk) ?? []), s]);
      }
      for (const [wk, list] of weeks) {
        const total = list.reduce((t, s) => t + workedMillis(s), 0);
        const max = ageOn(w.dateOfBirth, wk) < 15 ? 25 : 35;
        if (total > max * HOUR)
          out.push(find("block", list, `${w.name} is of school age and can work at most ${max} hours a week in the school holidays. The week of ${fmtDate(wk)} has ${fmtHours(total)}.`, { hours: total / HOUR }));
        else if (total > 12 * HOUR)
          out.push(find("warn", list, `${w.name} is of school age. In term time they can work at most 12 hours a week, and the week of ${fmtDate(wk)} has ${fmtHours(total)}. Only keep this if it is the school holidays.`, { hours: total / HOUR }));
      }
    }
    return out;
  },
};

export const NIGHT_HEALTH_LEGAL_REF = "Working Time Regulations 1998, reg 7 (free health assessment for night workers, before they start and at regular intervals)";
const NIGHT_MIN = 3 * HOUR;

/** Time a shift spends in the night period, 11pm to 6am UK time. */
const nightMillis = (s: Shift) => {
  const start = ms(s.start);
  const end = ms(s.end);
  const d = londonParts(start).date;
  return [addDays(d, -1), d].reduce((t, n) => {
    const from = londonDateTime(n, "23:00");
    const to = londonDateTime(addDays(n, 1), "06:00");
    return t + Math.max(0, Math.min(end, to) - Math.max(start, from));
  }, 0);
};

/**
 * Anyone who works at least 3 hours of a shift in the night period must be offered a free health assessment before they
 * start, and again every year. Under-18s are already kept off nights by another rule.
 */
export const nightHealth: Rule = {
  id: "wtr.night-health",
  version: 1,
  title: "Night worker health assessment",
  legalRef: NIGHT_HEALTH_LEGAL_REF,
  effectiveFrom: "1998-10-01",
  check(ctx) {
    const workers = new Map<string, Worker>(ctx.workers.map((w) => [w.id, w]));
    const out: Finding[] = [];
    for (const [workerId, shifts] of shiftsByWorker(ctx.shifts)) {
      const w = workers.get(workerId);
      if (!w) continue;
      const nights = shifts.filter((s) => nightMillis(s) >= NIGHT_MIN && londonParts(ms(s.start)).date >= addDays(ctx.asOf, -6));
      const due = nights.filter((s) => !w.nightHealthOfferedOn || w.nightHealthOfferedOn < addDays(londonParts(ms(s.start)).date, -365));
      if (!due.length) continue;
      out.push({
        ruleId: this.id,
        ruleVersion: this.version,
        severity: "warn",
        workerId,
        shiftIds: due.map((s) => s.id),
        message: w.nightHealthOfferedOn
          ? `${w.name} works nights and was last offered a free health assessment over a year ago. Offer another and record it on their staff record.`
          : `${w.name} works nights. Offer them a free health assessment before they start, and record it on their staff record.`,
        evidence: { nightShifts: due.length, lastOffered: w.nightHealthOfferedOn ?? "never" },
        legalRef: this.legalRef,
      });
    }
    return out;
  },
};
