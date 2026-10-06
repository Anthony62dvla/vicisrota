"use server";

import { missingParticulars, PAY_INTERVALS, writtenStatement, type PayInterval } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { notifyWorkers } from "@/lib/notify";
import { requestId } from "@/lib/request";
import { statementPersonFor, TERM_FIELDS } from "@/lib/statements";

export type FormState = { error?: string; ok?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_MAX = 1000;

/** The business's own terms. A blank box goes back to VicisRota's default wording. */
export async function saveTerms(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const payInterval = String(form.get("payInterval") ?? "");
  if (!(PAY_INTERVALS as readonly string[]).includes(payInterval)) return { error: "Choose how often people are paid." };
  const terms: Record<string, string> = { payInterval };
  for (const { key } of TERM_FIELDS) {
    const v = String(form.get(key) ?? "").trim().slice(0, TEXT_MAX);
    if (v) terms[key] = v;
  }
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ statementTerms: terms }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "statement_terms", entityId: organisationId });
  });
  revalidatePath("/statements");
  return { ok: "Saved. New statements will use these terms. Statements already given stay as they were." };
}

/** Gives someone their written statement: the words are saved exactly as given, and they are told. */
export async function giveStatement(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const field = (k: string) => String(form.get(k) ?? "").trim().slice(0, TEXT_MAX);
  const optional = (k: string) => (DATE.test(field(k)) ? field(k) : null);
  let issued: { id: string; workerId: string } | null = null;
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const known = await statementPersonFor(tx, organisationId, workerId);
    if (!known) return { error: "That person could not be found." };
    const person = {
      ...known,
      jobTitle: field("jobTitle"),
      startDate: optional("startDate"),
      continuousFrom: optional("continuousFrom"),
      hours: field("hours"),
      placeOfWork: field("placeOfWork"),
      temporaryUntil: optional("temporaryUntil"),
    };
    const missing = missingParticulars(person);
    if (missing.length) return { error: `Fill in the ${missing.join(", ")} first.${missing.includes("pay rate") ? " Add a pay rate on their staff record." : ""}` };
    const sections = writtenStatement(person, { ...known.terms, payInterval: (known.terms.payInterval ?? "monthly") as PayInterval });
    const [row] = await tx.insert(schema.writtenStatement).values({ organisationId, workerId, sections, issuedByUserId: user.id }).returning({ id: schema.writtenStatement.id });
    if (!known.startDate && person.startDate) await tx.update(schema.worker).set({ employmentStart: person.startDate }).where(eq(schema.worker.id, workerId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "written_statement", entityId: row!.id, data: { workerId } });
    issued = { id: row!.id, workerId };
    return {};
  });
  if (!issued) return result;
  const { id, workerId: to } = issued;
  await notifyWorkers(organisationId, [
    { workerId: to, purpose: "statement", title: "Your written statement", body: "Your written statement of your job, pay and terms is ready to read.", url: "/me/statement", dedupeKey: `statement:${id}` },
  ]);
  revalidatePath("/statements");
  redirect(`/statements/${id}?given=1`);
}
