import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { CONCERN_CATEGORIES, type ConcernCategory, type FormState } from "./concern-labels";
import { en, type Messages } from "./i18n/en";
import { requestId } from "./request";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX = 10_000;

/**
 * Records a concern exactly as written. Anonymous concerns store nothing about who raised them,
 * including in the audit trail. The audit trail never holds the details, only that a concern exists.
 */
export const raiseConcern = async (
  form: FormData,
  by: { organisationId: string; userId: string; name: string; allowedClientIds: Set<string> | "all" },
  t: Messages["concern"] = en.concern,
): Promise<FormState> => {
  const category = String(form.get("category") ?? "") as ConcernCategory;
  const details = String(form.get("details") ?? "").trim();
  const aboutPerson = String(form.get("aboutPerson") ?? "").trim() || null;
  const clientId = String(form.get("clientId") ?? "") || null;
  const happenedOn = String(form.get("happenedOn") ?? "") || null;
  const anonymous = form.get("anonymous") === "on";
  const immediateDanger = form.get("immediateDanger") === "on";

  const fail = (error: string): FormState => ({
    error,
    values: Object.fromEntries([...form.entries()].filter((e): e is [string, string] => typeof e[1] === "string" && !e[0].startsWith("$"))),
  });
  if (!CONCERN_CATEGORIES.includes(category)) return fail(t.chooseCategory);
  if (!details) return fail(t.writeWhat);
  if (details.length > MAX || (aboutPerson?.length ?? 0) > 200) return fail(t.tooLong);
  if (happenedOn && !DATE.test(happenedOn)) return fail(t.badDate);
  if (clientId && by.allowedClientIds !== "all" && !by.allowedClientIds.has(clientId)) return fail(t.badClient);

  await withOrganisation(db, by.organisationId, async (tx) => {
    if (clientId) {
      const [c] = await tx.select({ id: schema.client.id }).from(schema.client).where(and(eq(schema.client.id, clientId), eq(schema.client.organisationId, by.organisationId)));
      if (!c) throw new Error("client not in this business");
    }
    const [concern] = await tx
      .insert(schema.safeguardingConcern)
      .values({
        organisationId: by.organisationId,
        raisedByUserId: anonymous ? null : by.userId,
        raisedByName: anonymous ? null : by.name,
        category,
        clientId,
        aboutPerson,
        happenedOn,
        details,
        immediateDanger,
      })
      .returning({ id: schema.safeguardingConcern.id });
    await tx.insert(schema.auditEvent).values({
      organisationId: by.organisationId,
      actorUserId: anonymous ? null : by.userId,
      requestId: await requestId(),
      action: "create",
      entity: "safeguarding_concern",
      entityId: concern!.id,
      data: { category, anonymous, immediateDanger },
    });
  });
  return {
    ok: anonymous ? t.sentAnonymous : t.sent,
  };
};

/** Clients this person has been rostered to visit: the only ones they can name from the list. */
export const myClientIds = async (organisationId: string, workerId: string) =>
  new Set(
    (
      await withOrganisation(db, organisationId, (tx) =>
        tx
          .selectDistinct({ id: schema.shift.clientId })
          .from(schema.shift)
          .where(and(eq(schema.shift.workerId, workerId), isNotNull(schema.shift.clientId))),
      )
    ).map((r) => r.id!),
  );
