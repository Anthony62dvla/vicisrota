"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { NOTICE_HOUR_CHOICES, PAY_PERCENT_CHOICES } from "@/lib/short-notice-choices";

export type FormState = { error?: string; ok?: string };

export async function setShortNotice(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const raw = String(form.get("hours") ?? "");
  const hours = raw === "off" ? null : Number(raw);
  const percent = Number(form.get("percent") ?? 100);
  if (hours !== null && !(NOTICE_HOUR_CHOICES as readonly number[]).includes(hours)) return { error: "Choose how much notice staff should get, or turn this off." };
  if (!(PAY_PERCENT_CHOICES as readonly number[]).includes(percent)) return { error: "Choose how much of their lost pay to pay." };
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ shortNoticeHours: hours, shortNoticePayPercent: percent }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "short_notice_pay",
      entityId: organisationId,
      data: { hours, percent },
    });
  });
  revalidatePath("/short-notice");
  return {
    ok:
      hours === null
        ? "Short-notice pay is off. Payments already worked out are kept."
        : `Saved. From now on, when you cancel, move or cut short a published shift with less than ${hours} hours' notice, the person gets ${percent === 100 ? "full pay" : `${percent}% of their pay`} for the time they lose.`,
  };
}

/** Marks a payment as not owed, for example when the person asked for the change. The record is kept, with the reason. */
export async function waivePayment(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (reason.length < 3) return { error: "Say why this is not owed, so there is a record." };
  if (reason.length > 300) return { error: "Keep the reason under 300 characters." };
  const done = await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .update(schema.shortNoticePayment)
      .set({ waivedAt: new Date(), waivedReason: reason })
      .where(and(eq(schema.shortNoticePayment.id, id), isNull(schema.shortNoticePayment.waivedAt)))
      .returning({ id: schema.shortNoticePayment.id, pence: schema.shortNoticePayment.pence });
    if (!row) return false;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "waive",
      entity: "short_notice_payment",
      entityId: id,
      data: { reason, pence: row.pence },
    });
    return true;
  });
  if (!done) return { error: "That payment was already marked as not owed." };
  revalidatePath("/short-notice");
  revalidatePath("/timesheets");
  return { ok: "Marked as not owed. It will not be added to their pay." };
}
