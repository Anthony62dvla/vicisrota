import { londonParts, shortNoticePay } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { eq } from "drizzle-orm";

type ShiftTimes = { id: string; workerId: string | null; startsAt: Date; endsAt: Date; publishedAt: Date | null };

const MINUTE = 60_000;

/**
 * Works out and records short-notice pay when a manager changes a published shift. `after` is the same
 * person's shift after the change, or null when they no longer have it. Runs inside the change's
 * transaction, so the payment exists exactly when the change does. Returns what is owed, if anything.
 */
export const recordShortNotice = async (tx: Transaction, organisationId: string, before: ShiftTimes, after: { startsAt: Date; endsAt: Date } | null) => {
  if (!before.publishedAt || !before.workerId) return null;
  const [organisation] = await tx
    .select({ hours: schema.organisation.shortNoticeHours, percent: schema.organisation.shortNoticePayPercent })
    .from(schema.organisation)
    .where(eq(schema.organisation.id, organisationId));
  if (!organisation || organisation.hours === null) return null;
  const [rates, breaks, [worker]] = await Promise.all([
    tx.select().from(schema.payRate).where(eq(schema.payRate.workerId, before.workerId)),
    tx.select().from(schema.shiftBreak).where(eq(schema.shiftBreak.shiftId, before.id)),
    tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, before.workerId)),
  ]);
  const pay = shortNoticePay({
    before: {
      start: before.startsAt,
      end: before.endsAt,
      breakMinutes: breaks.reduce((s, b) => s + (b.endsAt.getTime() - b.startsAt.getTime()) / MINUTE, 0),
    },
    after: after && { start: after.startsAt, end: after.endsAt },
    changedAt: new Date(),
    noticeHours: organisation.hours,
    percent: organisation.percent,
    rates: rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    shiftDate: londonParts(before.startsAt.getTime()).date,
  });
  if (!pay) return null;
  await tx.insert(schema.shortNoticePayment).values({
    organisationId,
    workerId: before.workerId,
    shiftId: before.id,
    kind: pay.kind,
    shiftStartsAt: before.startsAt,
    shiftEndsAt: before.endsAt,
    lostMinutes: pay.lostMinutes,
    noticeHours: pay.noticeHours,
    pence: pay.pence,
  });
  return { ...pay, name: worker?.name ?? "They" };
};

/** What the manager is told after saving a change that is owed short-notice pay. */
export const owedMessage = (owed: { name: string; pence: number }) =>
  `${owed.name} will get £${(owed.pence / 100).toFixed(2)} short-notice pay for the time they lose. It is added to their pay automatically.`;
