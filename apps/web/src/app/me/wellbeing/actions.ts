"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { ANSWERS, NOTE_MAX, pendingCheckIns, tellManagersAboutChat } from "@/lib/wellbeing";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

/** Whether to be asked, after which shifts, and whether managers may see the answers. */
export async function saveWellbeingSettings(_: FormState, form: FormData): Promise<FormState> {
  const { organisationId, worker } = await requireStaff();
  const on = form.get("on") === "on";
  const after = form.get("after") === "every" ? "every" : "hard";
  const share = form.get("share") === "on";
  await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.worker)
      .set({ preferences: { ...worker.preferences, wellbeing: { on, after, share } } })
      .where(eq(schema.worker.id, worker.id)),
  );
  revalidatePath("/me/wellbeing");
  revalidatePath("/me");
  if (!on) return { ok: "Saved. You will not be asked. You can turn check-ins on again at any time." };
  return { ok: `Saved. We will ask after ${after === "every" ? "every shift" : "long shifts and nights"}. ${share ? "Your managers can see your answers." : "Only you can see your answers."}` };
}

/** Answers, or skips, the check-in for one shift. */
export async function checkIn(_: FormState, form: FormData): Promise<FormState> {
  const { organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const skip = form.get("skip") === "1";
  const answer = skip ? null : Number(form.get("answer"));
  const note = skip ? null : String(form.get("note") ?? "").trim() || null;
  const wantsChat = !skip && form.get("wantsChat") === "on";
  const values = { answer: String(answer ?? ""), note: note ?? "", wantsChat: wantsChat ? "on" : "" };
  if (!skip && !ANSWERS.some((a) => a.value === answer)) return { error: "Choose how your shift was, or skip it.", values };
  if (note && note.length > NOTE_MAX) return { error: `Keep the note to ${NOTE_MAX.toLocaleString("en-GB")} characters or fewer.`, values };
  const saved = await withOrganisation(db, organisationId, async (tx) => {
    const pending = await pendingCheckIns(tx, worker.id, new Date().getTime());
    if (!pending.some((s) => s.id === shiftId)) return false;
    await tx
      .insert(schema.wellbeingCheckIn)
      .values({ organisationId, workerId: worker.id, shiftId, answer, note, wantsChat, shared: !!worker.preferences.wellbeing?.share })
      .onConflictDoNothing();
    return true;
  });
  if (!saved) return { error: "That check-in has closed. Thank you anyway." };
  if (wantsChat) await tellManagersAboutChat(organisationId, worker.fullName);
  revalidatePath("/me/wellbeing");
  revalidatePath("/me");
  // The thank-you is shown by the page itself, because this form goes once the check-in is saved.
  return { ok: "Saved." };
}

/** Deletes one of the person's own check-ins. */
export async function deleteCheckIn(form: FormData) {
  const { organisationId, worker } = await requireStaff();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, (tx) =>
    tx.delete(schema.wellbeingCheckIn).where(and(eq(schema.wellbeingCheckIn.id, id), eq(schema.wellbeingCheckIn.workerId, worker.id))),
  );
  revalidatePath("/me/wellbeing");
}
