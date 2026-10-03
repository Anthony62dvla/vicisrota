import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { CONCERN_CATEGORIES, type ConcernCategory, type FormState } from "./concern-labels";
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
  if (!CONCERN_CATEGORIES.includes(category)) return fail("Choose what the concern is about.");
  if (!details) return fail("Write what happened or what you noticed. A few words is enough.");
  if (details.length > MAX || (aboutPerson?.length ?? 0) > 200) return fail("That is too long to save. Please shorten it.");
  if (happenedOn && !DATE.test(happenedOn)) return fail("Enter the date as day, month and year.");
  if (clientId && by.allowedClientIds !== "all" && !by.allowedClientIds.has(clientId)) return fail("Choose a client from the list.");

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
    ok: anonymous
      ? "Thank you. Your concern has been passed to the managers. Because you chose not to give your name, you will not see updates here."
      : "Thank you. Your concern has been passed to the managers. You can see what is happening with it below.",
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
