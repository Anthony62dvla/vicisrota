import { schema, withOrganisation } from "@vicisrota/db";
import { rotaChangeText } from "@vicisrota/messaging";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";
import type { Notice } from "./notices";
import { appUrl, sendTexts } from "./sms";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const when = (n: Notice) => `${day.format(n.startsAt).replace(",", "")} ${time.format(n.startsAt)}-${time.format(n.endsAt)}`;

/**
 * Texts each person whose rota just changed, if they asked for texts and gave a mobile number.
 * Runs after the change is saved; a failed text is logged and never undoes the change.
 */
export const textRotaChanges = async (organisationId: string, businessName: string, notices: Notice[]) => {
  if (!notices.length) return;
  try {
    const people = await withOrganisation(db, organisationId, (tx) =>
      tx
        .select({ id: schema.worker.id, mobile: schema.worker.mobile })
        .from(schema.worker)
        .where(
          and(
            inArray(schema.worker.id, [...new Set(notices.map((n) => n.workerId))]),
            isNotNull(schema.worker.mobile),
            sql`(${schema.worker.preferences}->>'textChanges')::boolean is true`,
          ),
        ),
    );
    for (const person of people) {
      const mine = notices.filter((n) => n.workerId === person.id).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const body = rotaChangeText({ business: businessName, changes: mine.map((n) => ({ kind: n.kind, when: when(n) })), link: appUrl("/me") });
      // Keyed on the first notice, so retrying the same change never texts twice.
      await sendTexts(organisationId, "rota_change", [{ to: person.mobile!, body }], `rota:${mine[0]!.id}`);
    }
  } catch (error) {
    await log("error", "rota change texts failed", { organisationId, error: String(error) });
  }
};
