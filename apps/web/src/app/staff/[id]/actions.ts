"use server";

import { schema, withOrganisation, type Transaction } from "@vicisrota/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DBS_LEVELS = ["basic", "standard", "enhanced", "enhanced_barred"] as const;
type DbsLevel = (typeof DBS_LEVELS)[number];

export type FormState = { error?: string; ok?: string };

const optionalDate = (value: FormDataEntryValue | null) => {
  const s = String(value ?? "");
  return DATE.test(s) ? s : null;
};

/** Foreign keys skip row-level security, so confirm the person belongs to this business first. */
const findWorker = async (tx: Transaction, workerId: string) =>
  (await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId)))[0];

export async function addCheck(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const checkedOn = String(form.get("checkedOn") ?? "");
  const expiresOn = optionalDate(form.get("expiresOn"));
  const level = String(form.get("dbsLevel") ?? "");
  const reference = String(form.get("reference") ?? "").trim() || null;
  if (kind !== "right_to_work" && kind !== "dbs") return { error: "Choose the type of check." };
  if (!DATE.test(checkedOn)) return { error: "Enter the date the check was done." };
  if (kind === "dbs" && !DBS_LEVELS.includes(level as DbsLevel)) return { error: "Choose the DBS level." };
  if (expiresOn && expiresOn < checkedOn) return { error: "The follow-up date must be after the check date." };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    const [row] = await tx
      .insert(schema.workerCheck)
      .values({
        organisationId,
        workerId,
        kind,
        checkedOn,
        expiresOn: kind === "right_to_work" ? expiresOn : null,
        dbsLevel: kind === "dbs" ? (level as DbsLevel) : null,
        reference,
      })
      .returning({ id: schema.workerCheck.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker_check",
      entityId: row!.id,
      // The reference (share code or certificate number) stays out of the audit trail.
      data: { workerId, kind, checkedOn, expiresOn, dbsLevel: kind === "dbs" ? level : null },
    });
    return { ok: `${kind === "dbs" ? "DBS check" : "Right to work check"} recorded for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function addTraining(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const achievedOn = optionalDate(form.get("achievedOn"));
  const expiresOn = optionalDate(form.get("expiresOn"));
  if (!name) return { error: "Enter the name of the training." };
  if (achievedOn && expiresOn && expiresOn < achievedOn) return { error: "The expiry date must be after the date it was achieved." };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    // Reuse the business's existing training type when the name matches, ignoring case.
    let [type] = await tx
      .select({ id: schema.qualification.id, name: schema.qualification.name })
      .from(schema.qualification)
      .where(sql`lower(${schema.qualification.name}) = lower(${name})`);
    if (!type) {
      [type] = await tx.insert(schema.qualification).values({ organisationId, name }).returning({ id: schema.qualification.id, name: schema.qualification.name });
    }
    const [row] = await tx
      .insert(schema.workerQualification)
      .values({ organisationId, workerId, qualificationId: type!.id, achievedOn, expiresOn })
      .returning({ id: schema.workerQualification.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker_qualification",
      entityId: row!.id,
      data: { workerId, qualification: type!.name, achievedOn, expiresOn },
    });
    return { ok: `${type!.name} recorded for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function removeTraining(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const workerId = String(form.get("workerId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .delete(schema.workerQualification)
      .where(and(eq(schema.workerQualification.id, id), eq(schema.workerQualification.workerId, workerId)))
      .returning({ id: schema.workerQualification.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "worker_qualification",
      entityId: id,
      data: { workerId },
    });
  });
  revalidatePath(`/staff/${workerId}`);
}
