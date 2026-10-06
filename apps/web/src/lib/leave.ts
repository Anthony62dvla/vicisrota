import { addDays, annualEntitlementDays, FAMILY_LEAVE, FAMILY_LEAVE_KINDS, irregularHoursAccrual, isFamilyLeave, leaveYear, londonDateTime, type LeaveKind } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gt, gte, inArray, lt, lte, ne } from "drizzle-orm";

export const LEAVE_LABEL: Record<LeaveKind, string> = {
  annual: "Holiday",
  sick: "Sick",
  ...(Object.fromEntries(FAMILY_LEAVE_KINDS.map((k) => [k, FAMILY_LEAVE[k].label])) as Record<(typeof FAMILY_LEAVE_KINDS)[number], string>),
  compassionate: "Compassionate leave",
  unpaid: "Unpaid leave",
  other: "Other leave",
  // Leave booked before family leave was split into its types.
  family: "Family leave",
};

/** The types people can choose, in a sensible order. The older "family" type is no longer offered. */
export const LEAVE_KINDS: LeaveKind[] = (Object.keys(LEAVE_LABEL) as LeaveKind[]).filter((k) => k !== "family");

/** Choices for a leave form, with a plain explanation for each type of family leave. */
export const leaveChoices = () => LEAVE_KINDS.map((k) => ({ value: k, label: LEAVE_LABEL[k], explain: isFamilyLeave(k) ? FAMILY_LEAVE[k].explain : undefined }));

export type Balance = {
  workerId: string;
  /** "days" for regular hours, "hours" for irregular hours and part-year workers. */
  unit: "days" | "hours";
  entitlement: number;
  taken: number;
  requested: number;
  remaining: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Holiday balances for the leave year containing `today`. Regular workers get 5.6 weeks (capped at
 * 28 days, pro rata for starters). Irregular-hours workers accrue 12.07% of hours worked on
 * published shifts so far this leave year. Runs inside withOrganisation.
 */
export const loadBalances = async (tx: Transaction, organisationId: string, today: string) => {
  const [org] = await tx
    .select({ startMonth: schema.organisation.leaveYearStartMonth })
    .from(schema.organisation)
    .where(eq(schema.organisation.id, organisationId));
  const year = leaveYear(today, org?.startMonth ?? 1);
  const workers = await tx.select().from(schema.worker);
  const leave = await tx
    .select()
    .from(schema.leaveRequest)
    .where(
      and(
        eq(schema.leaveRequest.kind, "annual"),
        inArray(schema.leaveRequest.status, ["requested", "approved"]),
        gte(schema.leaveRequest.startsOn, year.start),
        lte(schema.leaveRequest.startsOn, year.end),
      ),
    );

  const irregular = workers.filter((w) => w.irregularHours).map((w) => w.id);
  const workedHours = new Map<string, number>();
  if (irregular.length) {
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(
        and(
          inArray(schema.shift.workerId, irregular),
          eq(schema.shift.status, "published"),
          gte(schema.shift.startsAt, new Date(`${year.start}T00:00:00Z`)),
          lte(schema.shift.endsAt, new Date()),
        ),
      );
    const breaks = shifts.length
      ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id)))
      : [];
    for (const s of shifts) {
      const unpaid = breaks.filter((b) => b.shiftId === s.id).reduce((sum, b) => sum + (b.endsAt.getTime() - b.startsAt.getTime()), 0);
      const hours = (s.endsAt.getTime() - s.startsAt.getTime() - unpaid) / 3_600_000;
      workedHours.set(s.workerId!, (workedHours.get(s.workerId!) ?? 0) + hours);
    }
  }

  const balances = new Map<string, Balance>(
    workers.map((w) => {
      const unit = w.irregularHours ? "hours" : "days";
      const entitlement = w.irregularHours
        ? irregularHoursAccrual(workedHours.get(w.id) ?? 0)
        : annualEntitlementDays({ daysWorkedPerWeek: w.daysPerWeek, year, employmentStart: w.employmentStart });
      const mine = leave.filter((l) => l.workerId === w.id);
      const amount = (l: (typeof mine)[number]) => (unit === "hours" ? (l.hours ?? 0) : (l.days ?? 0));
      const taken = round(mine.filter((l) => l.status === "approved").reduce((s, l) => s + amount(l), 0));
      const requested = round(mine.filter((l) => l.status === "requested").reduce((s, l) => s + amount(l), 0));
      return [w.id, { workerId: w.id, unit, entitlement, taken, requested, remaining: round(entitlement - taken) }];
    }),
  );
  return { year, balances };
};

export const formatAmount = (n: number, unit: "days" | "hours") => {
  const value = Number.isInteger(n) ? String(n) : n.toFixed(unit === "hours" ? 2 : 1).replace(/\.?0+$/, "");
  return `${value} ${unit === "hours" ? (n === 1 ? "hour" : "hours") : n === 1 ? "day" : "days"}`;
};

/** Shifts already on the rota during the leave, so the manager knows to move them. */
export const clashNote = async (tx: Transaction, workerId: string, startsOn: string, endsOn: string) => {
  const shifts = await tx
    .select({ id: schema.shift.id })
    .from(schema.shift)
    .where(
      and(
        eq(schema.shift.workerId, workerId),
        ne(schema.shift.status, "cancelled"),
        // Shifts touching any day of the leave, including overnight shifts that run into it.
        lt(schema.shift.startsAt, new Date(londonDateTime(addDays(endsOn, 1), "00:00"))),
        gt(schema.shift.endsAt, new Date(londonDateTime(startsOn, "00:00"))),
      ),
    );
  return shifts.length
    ? ` They have ${shifts.length} shift${shifts.length === 1 ? "" : "s"} on the rota during this leave, which ${shifts.length === 1 ? "needs" : "need"} moving to someone else.`
    : "";
};

