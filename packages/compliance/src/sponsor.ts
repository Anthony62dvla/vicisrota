import { addDays } from "./time";
import type { LocalDate } from "./types";

/**
 * A worker the business sponsors on a Skilled Worker or Health and Care Worker visa. The business must keep
 * their details up to date, pay at least the salary on their certificate of sponsorship, and report certain
 * events on the Sponsor Management System within 10 working days.
 */
export interface Sponsorship {
  route: "skilled_worker" | "health_and_care" | "other";
  /** Certificate of sponsorship reference. */
  cosNumber?: string | null;
  /** Weekly hours on the certificate. */
  weeklyHours?: number | null;
  /** Gross yearly salary on the certificate, in pence. */
  annualSalaryPence?: number | null;
  /** First day of sponsored work. Monitoring starts here. */
  startedOn?: LocalDate | null;
}

export const SPONSOR_ROUTE_LABEL: Record<Sponsorship["route"], string> = {
  skilled_worker: "Skilled Worker",
  health_and_care: "Health and Care Worker",
  other: "Other sponsored route",
};

export const SPONSOR_LEGAL_REF = "Home Office, Workers and Temporary Workers: guidance for sponsors, Part 3 (sponsor duties and reporting)";

/** One rostered day for a sponsored worker. */
export interface SponsorDay {
  workerId: string;
  date: LocalDate;
  /** They clocked in, or their hours for the day were confirmed. */
  attended: boolean;
  /** Approved leave or sickness covering the day. */
  onLeave: boolean;
}

/** Gross pay for one complete Monday-to-Sunday week. */
export interface SponsorWeek {
  workerId: string;
  weekStart: LocalDate;
  pence: number;
  /** Approved leave or sickness in the week, which can lawfully lower pay. */
  hadLeave: boolean;
  /** Worked shifts with no confirmed hours yet, so the pay is not known. */
  unconfirmed: boolean;
}

export type SponsorDutyKind = "absence" | "left" | "pay" | "permission_ending" | "permission_ended" | "no_check";

export interface SponsorDuty {
  workerId: string;
  kind: SponsorDutyKind;
  /** The day the duty arose. Together with the worker and kind, it identifies the duty. */
  eventDate: LocalDate;
  /** Must be reported on the Sponsor Management System by this date. Null when nothing needs reporting. */
  reportBy: LocalDate | null;
  message: string;
}

const isWeekday = (date: LocalDate) => {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
};

/** Ten working days after a date, counting Monday to Friday. Bank holidays are not skipped, so the date errs early. */
export const workingDaysAfter = (date: LocalDate, days: number): LocalDate => {
  let d = date;
  for (let n = 0; n < days; ) {
    d = addDays(d, 1);
    if (isWeekday(d)) n++;
  }
  return d;
};

const longDate = (d: LocalDate) => {
  const date = new Date(`${d}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
  return `${part({ weekday: "long" })} ${part({ day: "numeric", month: "long" })} ${date.getUTCFullYear()}`;
};
const pounds = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (d: LocalDate) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long" });
const PAY_RULE = "Sponsored workers must be paid at least the salary on their certificate, apart from unpaid leave and sickness or family leave.";

/** Days of unauthorised absence after which the sponsor must report it. */
export const ABSENCE_LIMIT = 10;

/**
 * Everything a sponsor needs to report or look at for its sponsored workers today: unauthorised absence of
 * more than 10 rostered days in a row, leaving, pay below the sponsored salary, and permission to work that
 * is ending or has ended.
 */
export function sponsorDuties(input: {
  today: LocalDate;
  workers: {
    id: string;
    name: string;
    sponsorship: Sponsorship;
    leftOn: LocalDate | null;
    /** End of their latest right to work check. Null: no end date. Undefined: no check recorded. */
    permissionEndsOn: LocalDate | null | undefined;
  }[];
  days: SponsorDay[];
  weeks: SponsorWeek[];
}): SponsorDuty[] {
  const { today } = input;
  const duties: SponsorDuty[] = [];
  for (const w of input.workers) {
    const from = w.sponsorship.startedOn ?? "0000-01-01";
    if (w.leftOn) {
      duties.push({
        workerId: w.id,
        kind: "left",
        eventDate: w.leftOn,
        reportBy: workingDaysAfter(w.leftOn, 10),
        message: `${w.name}'s sponsored job ended on ${longDate(w.leftOn)}. Report that their employment has ended.`,
      });
    }

    // Unauthorised absence: rostered days missed in a row, ignoring days off and approved leave.
    const days = input.days.filter((d) => d.workerId === w.id && d.date >= from && d.date < today && !d.onLeave).sort((a, b) => (a.date < b.date ? -1 : 1));
    let run: SponsorDay[] = [];
    const closeRun = () => {
      if (run.length > ABSENCE_LIMIT) {
        const tenth = run[ABSENCE_LIMIT - 1]!.date;
        duties.push({
          workerId: w.id,
          kind: "absence",
          eventDate: run[0]!.date,
          reportBy: workingDaysAfter(tenth, 10),
          message: `${w.name} missed ${run.length} rostered days in a row from ${longDate(run[0]!.date)} without leave. If they were not at work, report it as unauthorised absence. If they were, confirm their hours on the timesheets.`,
        });
      }
      run = [];
    };
    for (const d of days) {
      if (d.attended) closeRun();
      else run.push(d);
    }
    closeRun();

    // Pay below the salary on the certificate, in weeks with no leave and all hours confirmed.
    const salary = w.sponsorship.annualSalaryPence;
    if (salary) {
      const weekly = Math.round(salary / 52);
      const short = input.weeks
        .filter((x) => x.workerId === w.id && x.weekStart >= from && !x.hadLeave && !x.unconfirmed && x.pence + 0.5 < weekly)
        .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
      if (short.length) {
        const lowest = Math.min(...short.map((x) => x.pence));
        duties.push({
          workerId: w.id,
          kind: "pay",
          eventDate: short[0]!.weekStart,
          reportBy: null,
          message:
            short.length === 1
              ? `${w.name} was paid ${pounds(short[0]!.pence)} in the week starting ${longDate(short[0]!.weekStart)}, below the sponsored salary of ${pounds(weekly)} a week. ${PAY_RULE}`
              : `${w.name} was paid below the sponsored salary of ${pounds(weekly)} a week in ${short.length} weeks, starting ${short.map((x) => shortDate(x.weekStart)).join(", ")}. The lowest was ${pounds(lowest)}. ${PAY_RULE}`,
        });
      }
    }

    if (w.permissionEndsOn === undefined) {
      duties.push({ workerId: w.id, kind: "no_check", eventDate: from === "0000-01-01" ? today : from, reportBy: null, message: `${w.name} has no right to work check recorded. Record it, with the date their permission ends.` });
    } else if (w.permissionEndsOn && w.permissionEndsOn < today) {
      duties.push({
        workerId: w.id,
        kind: "permission_ended",
        eventDate: w.permissionEndsOn,
        reportBy: null,
        message: `${w.name}'s permission to work ended on ${longDate(w.permissionEndsOn)}. They cannot be rostered until a new right to work check is recorded.`,
      });
    } else if (w.permissionEndsOn && w.permissionEndsOn <= addDays(today, 90)) {
      duties.push({
        workerId: w.id,
        kind: "permission_ending",
        eventDate: w.permissionEndsOn,
        reportBy: null,
        message: `${w.name}'s permission to work ends on ${longDate(w.permissionEndsOn)}. Talk to them about extending their visa, and check their new permission before that date.`,
      });
    }
  }
  return duties.sort((a, b) => ((a.reportBy ?? "9999") < (b.reportBy ?? "9999") ? -1 : (a.reportBy ?? "9999") > (b.reportBy ?? "9999") ? 1 : 0));
}
