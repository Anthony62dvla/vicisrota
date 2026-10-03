"use server";

import { allocateTips, tipsPayBy, type TipMethod } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { loadPayroll } from "@/lib/payroll";
import { requestId } from "@/lib/request";
import { parsePeriod } from "../timesheets/period";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES = ["card", "cash", "service_charge"] as const;

export type FormState = { error?: string; ok?: string };

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export async function recordTip(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const receivedOn = String(form.get("receivedOn") ?? "");
  const amount = Number(String(form.get("amount") ?? "").replace("£", ""));
  const source = String(form.get("source") ?? "") as (typeof SOURCES)[number];
  const note = String(form.get("note") ?? "").trim() || null;
  if (!DATE.test(receivedOn)) return { error: "Enter the date the tips were received." };
  if (!(amount > 0 && amount < 100000)) return { error: "Enter the amount in pounds, for example 86.40." };
  if (!SOURCES.includes(source)) return { error: "Choose how the tips were paid." };
  const amountPence = Math.round(amount * 100);

  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .insert(schema.tip)
      .values({ organisationId, receivedOn, amountPence, source, note, createdByUserId: user.id })
      .returning({ id: schema.tip.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "tip",
      entityId: row!.id,
      data: { receivedOn, amountPence, source },
    });
  });
  revalidatePath("/tips");
  return { ok: `${pounds(amountPence)} recorded for ${receivedOn}.` };
}

export async function removeTip(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    // Only tips not yet shared out can be removed; the database refuses the rest.
    const rows = await tx.delete(schema.tip).where(and(eq(schema.tip.id, id), isNull(schema.tip.allocationId))).returning();
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "tip",
      entityId: id,
      data: { receivedOn: rows[0]!.receivedOn, amountPence: rows[0]!.amountPence },
    });
  });
  revalidatePath("/tips");
}

/** Shares every unshared tip received in the period between the people who worked in it. */
export async function shareTips(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const period = parsePeriod(String(form.get("from") ?? ""), String(form.get("to") ?? ""));
  if ("error" in period) return { error: period.error };
  const method: TipMethod = form.get("method") === "equal" ? "equal" : "hours";
  const reference = await requestId();

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const tips = await tx
      .select()
      .from(schema.tip)
      .where(and(isNull(schema.tip.allocationId), gte(schema.tip.receivedOn, period.from), lte(schema.tip.receivedOn, period.to)))
      .for("update");
    const total = tips.reduce((s, t) => s + t.amountPence, 0);
    if (total === 0) return { error: "There are no unshared tips in this period." };
    const { lines } = await loadPayroll(tx, organisationId, period.from, period.to);
    const shares = allocateTips(total, lines.map((l) => ({ workerId: l.workerId, hours: l.hours + l.travelHours })), method);
    if (!shares.length) return { error: "Nobody has confirmed hours in this period yet. Confirm timesheets first, then share the tips." };
    const payBy = tips.map((t) => tipsPayBy(t.receivedOn)).sort()[0]!;
    const [allocation] = await tx
      .insert(schema.tipAllocation)
      .values({ organisationId, periodFrom: period.from, periodTo: period.to, totalPence: total, method, payBy, requestId: reference, createdByUserId: user.id })
      .returning({ id: schema.tipAllocation.id });
    await tx.insert(schema.tipShare).values(shares.map((s) => ({ organisationId, allocationId: allocation!.id, ...s })));
    await tx.update(schema.tip).set({ allocationId: allocation!.id }).where(inArray(schema.tip.id, tips.map((t) => t.id)));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: reference,
      action: "allocate",
      entity: "tip_allocation",
      entityId: allocation!.id,
      data: { from: period.from, to: period.to, totalPence: total, method, people: shares.length, payBy },
    });
    return { ok: `${pounds(total)} shared between ${shares.length} ${shares.length === 1 ? "person" : "people"}. Pay it by ${payBy}.` };
  });
  revalidatePath("/tips");
  return result;
}

export async function markTipsPaid(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .update(schema.tipAllocation)
      .set({ paidAt: new Date() })
      .where(and(eq(schema.tipAllocation.id, id), isNull(schema.tipAllocation.paidAt)))
      .returning({ id: schema.tipAllocation.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "mark_paid",
      entity: "tip_allocation",
      entityId: id,
    });
  });
  revalidatePath("/tips");
}

export async function saveTippingPolicy(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const policy = String(form.get("policy") ?? "").trim();
  if (policy.length < 50) return { error: "Write out how tips are shared, so staff can read it." };
  if (policy.length > 10000) return { error: "Keep the policy under 10,000 characters." };
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ tippingPolicy: policy }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "tipping_policy",
      entityId: organisationId,
      data: { length: policy.length },
    });
  });
  revalidatePath("/tips");
  revalidatePath("/me");
  return { ok: "Tipping policy saved. Your staff can now read it on their page." };
}
