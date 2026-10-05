import { schema, withOrganisation } from "@vicisrota/db";
import { langOf, localeOf, rotaChangeNotice, rotaChangeText, type Lang } from "@vicisrota/messaging";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";
import type { Notice } from "./notices";
import { notifyWorkers } from "./notify";
import { tellsChanges } from "@vicisrota/messaging";
import { appUrl } from "./sms";

const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const when = (n: Notice, lang: Lang = "en") =>
  `${new Intl.DateTimeFormat(localeOf(lang), { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(n.startsAt).replace(",", "")} ${time.format(n.startsAt)}-${time.format(n.endsAt)}`;

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
        .select({ id: schema.worker.id, preferences: schema.worker.preferences, language: schema.user.language })
        .from(schema.worker)
        .leftJoin(schema.user, eq(schema.worker.userId, schema.user.id))
        .where(inArray(schema.worker.id, [...new Set(notices.map((n) => n.workerId))])),
    );
    await notifyWorkers(
      organisationId,
      people
        .filter((p) => tellsChanges(p.preferences))
        .map((person) => {
          const lang = langOf(person.language);
          const mine = notices.filter((n) => n.workerId === person.id).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
          const changes = mine.map((n) => ({ kind: n.kind, when: when(n), id: n.id }));
          return {
            workerId: person.id,
            purpose: "rota_change",
            ...rotaChangeNotice({ business: businessName, changes: mine.map((n) => ({ kind: n.kind, when: when(n, lang) })) }, lang),
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
