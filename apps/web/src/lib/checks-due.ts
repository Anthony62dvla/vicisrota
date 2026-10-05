import { addDays, checksDue, londonParts, needsAction, type DueItem, type DuePerson } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, isNull, ne, or } from "drizzle-orm";
import { db } from "./db";
import { sendPush } from "./push";

/** Everyone's dated checks for a business: right to work, DBS, training and licences, supervisions. People who have left are not included. */
export const loadChecksDue = async (organisationId: string, today: string): Promise<DueItem[]> =>
  withOrganisation(db, organisationId, async (tx) => {
    const [org] = await tx
      .select({ requiresEnhancedDbs: schema.organisation.requiresEnhancedDbs })
      .from(schema.organisation)
      .where(eq(schema.organisation.id, organisationId));
    const workers = await tx
      .select({ id: schema.worker.id, name: schema.worker.fullName })
      .from(schema.worker)
      .where(or(isNull(schema.worker.leftOn), gte(schema.worker.leftOn, today)));
    const checks = await tx
      .select({
        workerId: schema.workerCheck.workerId,
        kind: schema.workerCheck.kind,
        checkedOn: schema.workerCheck.checkedOn,
        expiresOn: schema.workerCheck.expiresOn,
        dbsLevel: schema.workerCheck.dbsLevel,
        updateService: schema.workerCheck.updateService,
      })
      .from(schema.workerCheck);
    const training = await tx
      .select({ workerId: schema.workerQualification.workerId, name: schema.qualification.name, expiresOn: schema.workerQualification.expiresOn })
      .from(schema.workerQualification)
      .innerJoin(schema.qualification, eq(schema.workerQualification.qualificationId, schema.qualification.id));
    const supervisions = await tx
      .select({ workerId: schema.supervision.workerId, kind: schema.supervision.kind, heldOn: schema.supervision.heldOn, nextDueOn: schema.supervision.nextDueOn })
      .from(schema.supervision);
    const people: DuePerson[] = workers.map((w) => ({
      id: w.id,
      name: w.name,
      checks: checks.filter((c) => c.workerId === w.id),
      training: training.filter((t) => t.workerId === w.id),
      supervisions: supervisions.filter((s) => s.workerId === w.id),
    }));
    return checksDue(people, today, { requireEnhancedDbs: org?.requiresEnhancedDbs ?? false });
  });

/** A short line for the dashboard and the weekly reminder, or null when nothing needs doing. */
export const checksDueSummary = (items: DueItem[]) => {
  const act = needsAction(items);
  if (!act.length) return null;
  const count = (state: DueItem["state"]) => act.filter((i) => i.state === state).length;
  const parts = [
    count("missing") && `${count("missing")} not recorded`,
    count("overdue") && `${count("overdue")} overdue`,
    count("soon") && `${count("soon")} due in the next 30 days`,
  ].filter(Boolean);
  return { total: act.length, urgent: count("missing") + count("overdue") > 0, text: `Checks: ${parts.join(", ")}.` };
};

/** Days between reminders. */
const REMIND_EVERY_DAYS = 7;

/**
 * Once a week, from 9am, tells a business's owners and managers how many checks need doing, so a DBS
 * recheck or an SIA licence never runs out unnoticed. The message holds counts only, never names, as it
 * can show on a locked phone. Returns how many people it was sent to.
 */
export const remindChecksDue = async (organisationId: string, now: number): Promise<number> => {
  const { date: today, hour } = londonParts(now);
  if (hour < 9) return 0;
  const managers = await withOrganisation(db, organisationId, async (tx) => {
    const [org] = await tx
      .select({ last: schema.organisation.checksRemindedOn })
      .from(schema.organisation)
      .where(eq(schema.organisation.id, organisationId));
    if (org?.last && org.last > addDays(today, -REMIND_EVERY_DAYS)) return null;
    return tx
      .select({ userId: schema.membership.userId })
      .from(schema.membership)
      .where(and(eq(schema.membership.organisationId, organisationId), ne(schema.membership.role, "worker")));
  });
  if (!managers) return 0;
  const summary = checksDueSummary(await loadChecksDue(organisationId, today));
  // Recorded even when nothing is due, so the business is looked at again in a week rather than every few minutes.
  // The organisation table is not tenant-scoped.
  await db.update(schema.organisation).set({ checksRemindedOn: today }).where(eq(schema.organisation.id, organisationId));
  if (!summary || !managers.length) return 0;
  return sendPush(
    managers.map((m) => m.userId),
    { title: "Checks due", body: summary.text, url: "/checks", tag: `checks-due:${today}` },
  );
};
