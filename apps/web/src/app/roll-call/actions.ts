"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager, requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { notifyWorkers } from "@/lib/notify";
import { requestId } from "@/lib/request";
import { activeRollCall, peopleOnSite } from "@/lib/roll-call";
import { appUrl } from "@/lib/sms";

/** Starts a roll call with everyone who should be on site now. If one is already running, it carries on with that. */
export async function startRollCall() {
  const { user, organisationId, businessName } = await requireManager();
  const started = await withOrganisation(db, organisationId, async (tx) => {
    if (await activeRollCall(tx)) return null;
    const [call] = await tx.insert(schema.rollCall).values({ organisationId, startedByUserId: user.id }).returning();
    const people = await peopleOnSite(tx, new Date().getTime());
    if (people.length) {
      await tx.insert(schema.rollCallPerson).values(people.map((p) => ({ organisationId, rollCallId: call!.id, workerId: p.workerId, expected: p.expected, place: p.place })));
    }
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "start", entity: "roll_call", entityId: call!.id, data: { people: people.length } });
    return { id: call!.id, people };
  });
  if (!started) return;
  await log("info", "roll call started", { organisationId });
  // Urgent: pushed to their phones and texted to everyone with a mobile number, whatever they chose.
  await notifyWorkers(
    organisationId,
    started.people.map((p) => ({
      workerId: p.workerId,
      purpose: "roll_call",
      title: `${businessName}: fire roll call`,
      body: "If you are safe, open VicisRota and tap I'm safe. Do not go back inside.",
      url: "/me",
      dedupeKey: `roll_call:${started.id}`,
      text: `${businessName}: fire roll call. If you are safe, tap I'm safe here: ${appUrl("/me")} Do not go back inside.`,
      urgent: true,
    })),
  );
  revalidatePath("/roll-call");
}

/** Marks a person safe, or, if they were marked by mistake, not yet accounted for. */
export async function markSafe(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("personId") ?? "");
  const safe = form.get("safe") !== "false";
  await withOrganisation(db, organisationId, async (tx) => {
    const call = await activeRollCall(tx);
    if (!call) return;
    await tx
      .update(schema.rollCallPerson)
      .set(safe ? { safeAt: new Date(), markedBySelf: false, markedByUserId: user.id } : { safeAt: null, markedBySelf: false, markedByUserId: null })
      .where(and(eq(schema.rollCallPerson.id, id), eq(schema.rollCallPerson.rollCallId, call.id)));
  });
  revalidatePath("/roll-call");
}

/** Adds someone who is on site but was not on the list, for example a person who came in without a shift. */
export async function addToRollCall(form: FormData) {
  const { organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const call = await activeRollCall(tx);
    if (!call || !workerId) return;
    const [already] = await tx
      .select({ id: schema.rollCallPerson.id })
      .from(schema.rollCallPerson)
      .where(and(eq(schema.rollCallPerson.rollCallId, call.id), eq(schema.rollCallPerson.workerId, workerId)));
    if (!already) await tx.insert(schema.rollCallPerson).values({ organisationId, rollCallId: call.id, workerId, expected: "not_clocked_in" });
  });
  revalidatePath("/roll-call");
}

export async function endRollCall() {
  const { user, organisationId } = await requireManager();
  await withOrganisation(db, organisationId, async (tx) => {
    const call = await activeRollCall(tx);
    if (!call) return;
    const people = await tx.select().from(schema.rollCallPerson).where(eq(schema.rollCallPerson.rollCallId, call.id));
    await tx.update(schema.rollCall).set({ endedAt: new Date(), endedByUserId: user.id }).where(eq(schema.rollCall.id, call.id));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "end",
      entity: "roll_call",
      entityId: call.id,
      data: { people: people.length, safe: people.filter((p) => p.safeAt).length },
    });
  });
  revalidatePath("/roll-call");
}

/** A member of staff tells their manager they are safe, from their own phone. */
export async function iAmSafe() {
  const { organisationId, worker } = await requireStaff();
  await withOrganisation(db, organisationId, async (tx) => {
    const call = await activeRollCall(tx);
    if (!call) return;
    const [mine] = await tx
      .select({ id: schema.rollCallPerson.id })
      .from(schema.rollCallPerson)
      .where(and(eq(schema.rollCallPerson.rollCallId, call.id), eq(schema.rollCallPerson.workerId, worker.id)));
    if (mine) {
      await tx
        .update(schema.rollCallPerson)
        .set({ safeAt: new Date(), markedBySelf: true })
        .where(and(eq(schema.rollCallPerson.id, mine.id), isNull(schema.rollCallPerson.safeAt)));
    } else {
      await tx.insert(schema.rollCallPerson).values({ organisationId, rollCallId: call.id, workerId: worker.id, expected: "not_clocked_in", safeAt: new Date(), markedBySelf: true });
    }
  });
  revalidatePath("/me");
  revalidatePath("/roll-call");
}
