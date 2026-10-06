import { MESSAGES_KEPT_DAYS, retentionStage } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db } from "./db";

/**
 * Deletes what one business no longer needs to keep (see RETENTION_RULES). Run daily by the scheduler.
 * Safeguarding records and the audit log are never deleted here: they have their own, longer, legal reasons to be kept.
 */
export const applyRetention = async (organisationId: string, now: number, today: string) =>
  withOrganisation(db, organisationId, async (tx) => {
    const cutoff = new Date(now - MESSAGES_KEPT_DAYS * 86_400_000);
    await tx.delete(schema.notification).where(lt(schema.notification.createdAt, cutoff));
    await tx.delete(schema.smsMessage).where(lt(schema.smsMessage.createdAt, cutoff));

    const leavers = await tx.select({ id: schema.worker.id, leftOn: schema.worker.leftOn }).from(schema.worker).where(isNotNull(schema.worker.leftOn));
    const minimise = leavers.filter((w) => retentionStage(w.leftOn, today) === "minimise").map((w) => w.id);
    const remove = leavers.filter((w) => retentionStage(w.leftOn, today) === "delete").map((w) => w.id);
    const trim = [...minimise, ...remove];
    if (trim.length) {
      for (const table of [
        schema.workerCheck,
        schema.wellbeingCheckIn,
        schema.workerUnavailability,
        schema.notification,
        schema.rotaNotice,
        schema.announcementRead,
        schema.shiftClaim,
        schema.invitation,
        schema.nightHealthAssessment,
        schema.sponsorReport,
        schema.workerRole,
      ])
        await tx.delete(table).where(inArray(table.workerId, trim));
      await tx.delete(schema.shiftSwap).where(or(inArray(schema.shiftSwap.fromWorkerId, trim), inArray(schema.shiftSwap.toWorkerId, trim)));
      await tx.delete(schema.keepApart).where(or(inArray(schema.keepApart.firstWorkerId, trim), inArray(schema.keepApart.secondWorkerId, trim)));
      await tx
        .update(schema.worker)
        .set({
          mobile: null,
          adjustments: {},
          workProfile: {},
          preferences: {},
          pinHash: null,
          sponsorship: null,
          agency: null,
          personalLicence: null,
          childWorkPermit: null,
          sundayOptOut: null,
        })
        .where(inArray(schema.worker.id, trim));
    }
    if (remove.length) {
      // Tip shares do not cascade, so a payout can never vanish by accident; remove them first.
      await tx.delete(schema.tipShare).where(inArray(schema.tipShare.workerId, remove));
      // Shifts stay on the rota with no one named; everything else about the person goes with them.
      await tx.delete(schema.worker).where(inArray(schema.worker.id, remove));
      await tx.insert(schema.auditEvent).values({ organisationId, action: "delete", entity: "worker_retention", data: { count: remove.length } });
    }
    if (minimise.length) await tx.insert(schema.auditEvent).values({ organisationId, action: "update", entity: "worker_retention", data: { count: minimise.length } });
    return { minimised: minimise.length, deleted: remove.length };
  });

/** Everything VicisRota holds about one person, for a subject access request or for them to take elsewhere. */
export const workerData = async (organisationId: string, workerId: string) =>
  withOrganisation(db, organisationId, async (tx) => {
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!worker) return null;
    // The clock-in PIN is a secret, not information about the person.
    const record: Partial<typeof worker> = { ...worker };
    delete record.pinHash;
    delete record.pinFailures;
    delete record.pinLockedUntil;
    const byWorker = async (table: typeof schema.payRate | typeof schema.shift) => tx.select().from(table).where(eq(table.workerId, workerId));
    const shifts = await byWorker(schema.shift);
    return {
      exportedAt: new Date().toISOString(),
      note: "Everything VicisRota holds about you for this employer. Safeguarding records and private safety arrangements are not included, because the law allows them to be withheld to protect others. Ask your employer if you want to know more.",
      you: record,
      payRates: await byWorker(schema.payRate),
      shifts,
      timeEntries: await tx.select().from(schema.timeEntry).where(eq(schema.timeEntry.workerId, workerId)),
      clockEvents: await tx.select().from(schema.clockEvent).where(eq(schema.clockEvent.workerId, workerId)),
      leave: await tx.select().from(schema.leaveRequest).where(eq(schema.leaveRequest.workerId, workerId)),
      checks: await tx.select().from(schema.workerCheck).where(eq(schema.workerCheck.workerId, workerId)),
      training: await tx.select().from(schema.workerQualification).where(eq(schema.workerQualification.workerId, workerId)),
      supervision: await tx.select().from(schema.supervision).where(eq(schema.supervision.workerId, workerId)),
      writtenStatements: await tx.select().from(schema.writtenStatement).where(eq(schema.writtenStatement.workerId, workerId)),
      tips: await tx.select().from(schema.tipShare).where(eq(schema.tipShare.workerId, workerId)),
      shortNoticePay: await tx.select().from(schema.shortNoticePayment).where(eq(schema.shortNoticePayment.workerId, workerId)),
      timesYouCantWork: await tx.select().from(schema.workerUnavailability).where(eq(schema.workerUnavailability.workerId, workerId)),
      wellbeingCheckIns: await tx.select().from(schema.wellbeingCheckIn).where(eq(schema.wellbeingCheckIn.workerId, workerId)),
      nightHealthAssessments: await tx.select().from(schema.nightHealthAssessment).where(eq(schema.nightHealthAssessment.workerId, workerId)),
      notifications: await tx.select().from(schema.notification).where(eq(schema.notification.workerId, workerId)),
      swaps: await tx.select().from(schema.shiftSwap).where(or(eq(schema.shiftSwap.fromWorkerId, workerId), eq(schema.shiftSwap.toWorkerId, workerId))),
      pickUpRequests: await tx.select().from(schema.shiftClaim).where(eq(schema.shiftClaim.workerId, workerId)),
      sponsorReports: await tx.select().from(schema.sponsorReport).where(eq(schema.sponsorReport.workerId, workerId)),
    };
  });

export const dataFileName = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my"}-data.json`;

const DAY = 86_400_000;
/** Sign-in records (with the IP address and browser they came from) are kept this long after they were last used. */
export const SECURITY_RECORDS_KEPT_DAYS = 90;
/** Problem reports sent through Report a problem are kept this long. */
export const PROBLEM_REPORTS_KEPT_DAYS = 2 * 365;

/** Deletes VicisRota's own records past the periods in the privacy policy. Run daily by the scheduler, alongside applyRetention. */
export const applyPlatformRetention = async (now: number) => {
  const securityCutoff = new Date(now - SECURITY_RECORDS_KEPT_DAYS * DAY);
  await db.delete(schema.session).where(and(lt(schema.session.expiresAt, new Date(now)), lt(schema.session.updatedAt, securityCutoff)));
  await db.delete(schema.supportReport).where(lt(schema.supportReport.createdAt, new Date(now - PROBLEM_REPORTS_KEPT_DAYS * DAY)));
};
