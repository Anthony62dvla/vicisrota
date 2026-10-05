"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/business";
import { db } from "@/lib/db";
import { MESSAGE_MAX, notifyNewMessage, openConversation, peopleInBusiness } from "@/lib/messages";
import { requestId } from "@/lib/request";

/** values: what was typed, sent back on an error so the form is not cleared. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string>; sentAt?: number };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Opens the one-to-one conversation with a colleague, starting it if this is the first message. */
export async function startDirect(form: FormData) {
  const { user, organisationId } = await requireMember();
  const other = String(form.get("userId") ?? "");
  if (!other || other === user.id) redirect("/messages");
  const id = await withOrganisation(db, organisationId, async (tx) => {
    const people = await peopleInBusiness(tx, organisationId);
    if (!people.some((p) => p.userId === other)) return null;
    // An existing one-to-one: no name and exactly these two people.
    const directs = await tx
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .innerJoin(schema.conversationMember, eq(schema.conversationMember.conversationId, schema.conversation.id))
      .where(and(isNull(schema.conversation.name), eq(schema.conversationMember.userId, user.id)));
    const members = directs.length
      ? await tx
          .select({ conversationId: schema.conversationMember.conversationId, userId: schema.conversationMember.userId })
          .from(schema.conversationMember)
          .where(inArray(schema.conversationMember.conversationId, directs.map((d) => d.id)))
      : [];
    const existing = directs.find((d) => {
      const who = members.filter((m) => m.conversationId === d.id).map((m) => m.userId);
      return who.length === 2 && who.includes(other);
    });
    if (existing) return existing.id;
    const [created] = await tx.insert(schema.conversation).values({ organisationId, createdByUserId: user.id }).returning({ id: schema.conversation.id });
    await tx.insert(schema.conversationMember).values([user.id, other].map((userId) => ({ organisationId, conversationId: created!.id, userId })));
    return created!.id;
  });
  redirect(id ? `/messages/${id}` : "/messages");
}

/** Managers set up group conversations, such as "Kitchen team", and choose who is in them. */
export async function createGroup(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, isManager } = await requireMember();
  if (!isManager) return { error: "Only managers can set up groups." };
  const name = String(form.get("name") ?? "").trim();
  const chosen = form.getAll("members").map(String);
  const values = { name };
  if (!name || name.length > 60) return { error: "Give the group a short name (up to 60 characters).", values };
  const id = await withOrganisation(db, organisationId, async (tx) => {
    const people = new Set((await peopleInBusiness(tx, organisationId)).map((p) => p.userId));
    const members = [...new Set([user.id, ...chosen.filter((c) => people.has(c))])];
    if (members.length < 2) return null;
    const [created] = await tx.insert(schema.conversation).values({ organisationId, name, createdByUserId: user.id }).returning({ id: schema.conversation.id });
    await tx.insert(schema.conversationMember).values(members.map((userId) => ({ organisationId, conversationId: created!.id, userId })));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "conversation", entityId: created!.id, data: { name, members: members.length } });
    return created!.id;
  });
  if (!id) return { error: "Choose at least one person to be in the group.", values };
  redirect(`/messages/${id}`);
}

/** Adds people to a group, or takes them out. Managers in the group only. */
export async function setGroupMembers(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, isManager } = await requireMember();
  const conversationId = String(form.get("conversationId") ?? "");
  const chosen = form.getAll("members").map(String);
  if (!isManager) return { error: "Only managers can change who is in a group." };
  const done = await withOrganisation(db, organisationId, async (tx) => {
    const conversation = await openConversation(tx, conversationId, user.id);
    if (!conversation?.name) return false;
    const people = new Set((await peopleInBusiness(tx, organisationId)).map((p) => p.userId));
    const members = new Set([user.id, ...chosen.filter((c) => people.has(c))]);
    const current = (await tx.select({ userId: schema.conversationMember.userId }).from(schema.conversationMember).where(eq(schema.conversationMember.conversationId, conversationId))).map((m) => m.userId);
    const add = [...members].filter((m) => !current.includes(m));
    const remove = current.filter((m) => !members.has(m));
    if (add.length) await tx.insert(schema.conversationMember).values(add.map((userId) => ({ organisationId, conversationId, userId })));
    if (remove.length) await tx.delete(schema.conversationMember).where(and(eq(schema.conversationMember.conversationId, conversationId), inArray(schema.conversationMember.userId, remove)));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "members", entity: "conversation", entityId: conversationId, data: { added: add.length, removed: remove.length } });
    return true;
  });
  if (!done) return { error: "That group could not be changed." };
  revalidatePath(`/messages/${conversationId}`);
  return { ok: "Saved. People added can see earlier messages in the group too." };
}

export async function sendMessage(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireMember();
  const conversationId = String(form.get("conversationId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return {};
  if (body.length > MESSAGE_MAX) return { error: `Messages can be up to ${MESSAGE_MAX.toLocaleString("en-GB")} characters. This one is ${body.length.toLocaleString("en-GB")}.`, values: { body } };
  const conversation = await withOrganisation(db, organisationId, async (tx) => {
    const conversation = await openConversation(tx, conversationId, user.id);
    if (!conversation) return null;
    const now = new Date();
    await tx.insert(schema.message).values({ organisationId, conversationId, senderUserId: user.id, body, createdAt: now });
    await tx.update(schema.conversation).set({ lastMessageAt: now }).where(eq(schema.conversation.id, conversationId));
    await tx
      .update(schema.conversationMember)
      .set({ lastReadAt: now })
      .where(and(eq(schema.conversationMember.conversationId, conversationId), eq(schema.conversationMember.userId, user.id)));
    return conversation;
  });
  if (!conversation) return { error: "You are no longer in this conversation." };
  await notifyNewMessage(organisationId, conversation, { userId: user.id, name: user.name });
  revalidatePath(`/messages/${conversationId}`);
  return { sentAt: new Date().getTime() };
}

/** Marks everything in a conversation as read, when the person has it open. */
export async function markRead(conversationId: string) {
  const { user, organisationId } = await requireMember();
  await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.conversationMember)
      .set({ lastReadAt: new Date() })
      .where(and(eq(schema.conversationMember.conversationId, conversationId), eq(schema.conversationMember.userId, user.id))),
  );
}

/** When the person does not want message notifications from this business. */
export async function saveQuietHours(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireMember();
  const on = form.get("quietOn") === "on";
  const from = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "");
  const daysOff = form.get("daysOff") === "on";
  const values = { quietOn: on ? "on" : "", from, to, daysOff: daysOff ? "on" : "" };
  if (on && (!TIME.test(from) || !TIME.test(to))) return { error: "Choose the times your quiet hours start and end.", values };
  if (on && from === to) return { error: "Quiet hours need a different start and end time.", values };
  await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.membership)
      .set({ messageQuiet: on ? { from, to, daysOff } : { from: null, to: null, daysOff } })
      .where(and(eq(schema.membership.organisationId, organisationId), eq(schema.membership.userId, user.id))),
  );
  revalidatePath("/messages");
  return { ok: "Saved. Messages still arrive in VicisRota at any time; only the notification waits." };
}
