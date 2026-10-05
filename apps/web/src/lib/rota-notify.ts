import { schema, withOrganisation } from "@vicisrota/db";
import { rotaChangeNotice, rotaChangeText } from "@vicisrota/messaging";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";
import type { Notice } from "./notices";
import { notifyWorkers } from "./notify";
import { tellsChanges } from "@vicisrota/messaging";
import { appUrl } from "./sms";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const when = (n: Notice) => `${day.format(n.startsAt).replace(",", "")} ${time.format(n.startsAt)}-${time.format(n.endsAt)}`;

/**
 * Tells each person whose rota just changed, unless they turned rota change messages off: on their
 * page, as an app notification and, if they chose texts, by text. Runs after the change is saved;
 * a failure is logged and never undoes the change.
 */
export const notifyRotaChanges = async (organisationId: string, businessName: string, notices: Notice[]) => {
  if (!notices.length) return;
  try {
    const people = await withOrganisation(db, organisationId, (tx) =>
      tx
        .select({ id: schema.worker.id, preferences: schema.worker.preferences })
        .from(schema.worker)
        .where(inArray(schema.worker.id, [...new Set(notices.map((n) => n.workerId))])),
    );
    await notifyWorkers(
      organisationId,
      people
        .filter((p) => tellsChanges(p.preferences))
        .map((person) => {
          const changes = notices
            .filter((n) => n.workerId === person.id)
            .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
            .map((n) => ({ kind: n.kind, when: when(n), id: n.id }));
          return {
            workerId: person.id,
            purpose: "rota_change",
            ...rotaChangeNotice({ business: businessName, changes }),
            url: "/me",
            // Keyed on the first notice, so retrying the same change never tells them twice.
            dedupeKey: `rota:${changes[0]!.id}`,
            text: rotaChangeText({ business: businessName, changes, link: appUrl("/me") }),
          };
        }),
    );
  } catch (error) {
    await log("error", "rota change messages failed", { organisationId, error: String(error) });
  }
};
