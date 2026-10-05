import { schema, withOrganisation } from "@vicisrota/db";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";
import { wantsTexts } from "@vicisrota/messaging";
import { sendPush } from "./push";
import { sendTexts } from "./sms";

export type Notify = {
  workerId: string;
  purpose: string;
  title: string;
  body: string;
  /** The page it opens, e.g. /me. */
  url: string;
  /** The same key never goes out twice to the same person. */
  dedupeKey: string;
  /** The text message version. Without one, it is never texted. */
  text?: string;
  /** Urgent (a fire roll call): texted to anyone with a mobile number, whatever they chose. */
  urgent?: boolean;
};

/**
 * Tells staff something. It is always kept on their own page, pushed free to every device where they
 * turned on app notifications, and texted only if they chose texts (or it is urgent). Runs after the
 * change that caused it is saved: a failure is logged and never undoes that change.
 */
export const notifyWorkers = async (organisationId: string, items: Notify[]): Promise<{ pushed: number; texted: number }> => {
  const total = { pushed: 0, texted: 0 };
  if (!items.length) return total;
  try {
    const { created, people } = await withOrganisation(db, organisationId, async (tx) => {
      const created = await tx
        .insert(schema.notification)
        .values(items.map((i) => ({ organisationId, workerId: i.workerId, purpose: i.purpose, title: i.title, body: i.body, url: i.url, dedupeKey: i.dedupeKey })))
        .onConflictDoNothing()
        .returning({ id: schema.notification.id, workerId: schema.notification.workerId, dedupeKey: schema.notification.dedupeKey });
      const people = created.length
        ? await tx
            .select({ id: schema.worker.id, userId: schema.worker.userId, mobile: schema.worker.mobile, preferences: schema.worker.preferences })
            .from(schema.worker)
            .where(inArray(schema.worker.id, [...new Set(created.map((c) => c.workerId))]))
        : [];
      return { created, people };
    });

    for (const row of created) {
      const item = items.find((i) => i.workerId === row.workerId && i.dedupeKey === row.dedupeKey)!;
      const person = people.find((p) => p.id === row.workerId);
      if (!person) continue;
      const pushed = person.userId ? await sendPush([person.userId], { title: item.title, body: item.body, url: item.url, tag: item.dedupeKey }, item.urgent) : 0;
      const textable = item.text && person.mobile && (item.urgent || wantsTexts(person.preferences, person.mobile));
      const texted = textable ? (await sendTexts(organisationId, item.purpose, [{ to: person.mobile!, body: item.text! }], item.dedupeKey)) > 0 : false;
      total.pushed += pushed;
      if (texted) total.texted++;
      if (pushed || texted) {
        await withOrganisation(db, organisationId, (tx) => tx.update(schema.notification).set({ pushed, texted }).where(eq(schema.notification.id, row.id)));
      }
    }
  } catch (error) {
    await log("error", "notifying staff failed", { organisationId, error: String(error) });
  }
  return total;
};
