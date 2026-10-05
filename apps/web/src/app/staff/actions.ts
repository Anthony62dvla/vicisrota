"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { addingBlocked } from "@/lib/plan";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FormState = { error?: string; ok?: string };

export async function addWorker(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const fullName = String(form.get("fullName") ?? "").trim();
  const dateOfBirth = String(form.get("dateOfBirth") ?? "");
  const rate = Number(String(form.get("hourlyRate") ?? "").replace("£", ""));
  const rateFrom = String(form.get("rateFrom") ?? "");
  if (!fullName) return { error: "Enter the person's name." };
  if (!DATE.test(dateOfBirth)) return { error: "Enter a date of birth." };
  if (!(rate > 0 && rate < 1000)) return { error: "Enter an hourly rate in pounds, for example 12.71." };
  if (!DATE.test(rateFrom)) return { error: "Enter the date the pay rate starts." };
  const employmentStart = String(form.get("employmentStart") ?? "");
  const daysPerWeek = Number(form.get("daysPerWeek") ?? 5);
  if (employmentStart && !DATE.test(employmentStart)) return { error: "Enter a valid start date." };
  if (!(daysPerWeek > 0 && daysPerWeek <= 7)) return { error: "Enter the usual days worked a week, between 0.5 and 7." };
  const full = await addingBlocked(organisationId);
  if (full) return { error: full };

  await withOrganisation(db, organisationId, async (tx) => {
    const [worker] = await tx
      .insert(schema.worker)
      .values({
        organisationId,
        fullName,
        dateOfBirth,
        optedOutOf48HourLimit: form.get("optedOut") === "on",
        apprenticeRateApplies: form.get("apprentice") === "on",
        employmentStart: employmentStart || null,
        daysPerWeek,
        irregularHours: form.get("irregularHours") === "on",
      })
      .returning({ id: schema.worker.id });
    const hourlyPence = Math.round(rate * 100);
    await tx.insert(schema.payRate).values({ organisationId, workerId: worker!.id, hourlyPence, effectiveFrom: rateFrom });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker",
      entityId: worker!.id,
      data: { fullName, hourlyPence, rateFrom },
    });
  });
  revalidatePath("/staff");
  return { ok: `${fullName} has been added.` };
}
