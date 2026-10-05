import { addDays, londonDateTime, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation, type Transaction as Tx } from "@vicisrota/db";
import { isQuiet } from "@vicisrota/messaging";
import { and, desc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";
import { sendPush } from "./push";

/** Longest message, about a page of writing. */
export const MESSAGE_MAX = 2000;

/** Everyone in the business, by name, for choosing who to message. */
export const peopleInBusiness = (tx: Tx, organisationId: string) =>
  tx
    .select({ userId: schema.membership.userId, name: schema.user.name, role: schema.membership.role })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.membership.userId, schema.user.id))
    .where(eq(schema.membership.organisationId, organisationId))
    .orderBy(schema.user.name);

/** The person's conversations, newest first, each with its name and how many messages are new to them. */
export const myConversations = async (tx: Tx, userId: string) => {
  const mine = await tx
    .select({ conversation: schema.conversation, lastReadAt: schema.conversationMember.lastReadAt })
    .from(schema.conversationMember)
    .innerJoin(schema.conversation, eq(schema.conversationMember.conversationId, schema.conversation.id))
    .where(eq(schema.conversationMember.userId, userId))
    .orderBy(sql`${schema.conversation.lastMessageAt} desc nulls last`, desc(schema.conversation.createdAt));
  if (!mine.length) return [];
  const ids = mine.map((m) => m.conversation.id);
  const others = await tx
    .select({ conversationId: schema.conversationMember.conversationId, name: schema.user.name })
    .from(schema.conversationMember)
    .innerJoin(schema.user, eq(schema.conversationMember.userId, schema.user.id))
    .where(and(inArray(schema.conversationMember.conversationId, ids), ne(schema.conversationMember.userId, userId)));
  const unread = await tx
    .select({ conversationId: schema.message.conversationId, count: sql<number>`count(*)::int` })
    .from(schema.message)
    .innerJoin(
      schema.conversationMember,
      and(eq(schema.conversationMember.conversationId, schema.message.conversationId), eq(schema.conversationMember.userId, userId)),
    )
    .where(
      and(
        inArray(schema.message.conversationId, ids),
        or(isNull(schema.message.senderUserId), ne(schema.message.senderUserId, userId)),
        or(isNull(schema.conversationMember.lastReadAt), gt(schema.message.createdAt, schema.conversationMember.lastReadAt)),
      ),
    )
    .groupBy(schema.message.conversationId);
  return mine.map(({ conversation }) => {
    const names = others.filter((o) => o.conversationId === conversation.id).map((o) => o.name);
    return {
      id: conversation.id,
      isGroup: conversation.name !== null,
      title: conversation.name ?? names[0] ?? "Just you",
      people: names,
      lastMessageAt: conversation.lastMessageAt,
      unread: unread.find((u) => u.conversationId === conversation.id)?.count ?? 0,
    };
  });
};

/** A conversation, only if this person is in it. Managers who are not in it get nothing. */
export const openConversation = async (tx: Tx, id: string, userId: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await tx
    .select({ conversation: schema.conversation })
    .from(schema.conversationMember)
    .innerJoin(schema.conversation, eq(schema.conversationMember.conversationId, schema.conversation.id))
    .where(and(eq(schema.conversationMember.conversationId, id), eq(schema.conversationMember.userId, userId)));
  return row?.conversation ?? null;
};

/** Total new messages for a person, for the menu. */
export const unreadCount = async (organisationId: string, userId: string) =>
  withOrganisation(db, organisationId, async (tx) => (await myConversations(tx, userId)).reduce((n, c) => n + c.unread, 0));

/**
 * Sends an app notification about a new message to everyone else in the conversation, unless it is
 * their quiet time. It only says who wrote, never what they wrote, so nothing private shows on a
 * locked phone. Quiet-time messages are simply there when the person next opens VicisRota.
 */
export const notifyNewMessage = async (organisationId: string, conversation: { id: string; name: string | null }, sender: { userId: string; name: string }) => {
  try {
    const now = new Date().getTime();
    const { date, hour, minute } = londonParts(now);
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const recipients = await withOrganisation(db, organisationId, async (tx) => {
      const members = await tx
        .select({ userId: schema.conversationMember.userId, quiet: schema.membership.messageQuiet, role: schema.membership.role })
        .from(schema.conversationMember)
        .innerJoin(
          schema.membership,
          and(eq(schema.membership.userId, schema.conversationMember.userId), eq(schema.membership.organisationId, organisationId)),
        )
        .where(and(eq(schema.conversationMember.conversationId, conversation.id), ne(schema.conversationMember.userId, sender.userId)));
      const staffIds = members.filter((m) => m.role === "worker").map((m) => m.userId);
      // Staff with a published shift today are working; anyone else on the staff list is on a day off.
      const working = staffIds.length
        ? await tx
            .selectDistinct({ userId: schema.worker.userId })
            .from(schema.shift)
            .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
            .where(
              and(
                inArray(schema.worker.userId, staffIds),
                eq(schema.shift.status, "published"),
                lt(schema.shift.startsAt, new Date(londonDateTime(addDays(date, 1), "00:00"))),
                gte(schema.shift.endsAt, new Date(londonDateTime(date, "00:00"))),
              ),
            )
        : [];
      return members.filter((m) => !isQuiet(m.quiet, time, m.role === "worker" && !working.some((w) => w.userId === m.userId)));
    });
    const title = conversation.name ? `${sender.name} in ${conversation.name}` : `Message from ${sender.name}`;
    await sendPush(
      recipients.map((r) => r.userId),
      { title, body: "Open VicisRota to read it.", url: `/messages/${conversation.id}`, tag: `msg:${conversation.id}` },
    );
  } catch (error) {
    await log("error", "message notification failed", { organisationId, error: String(error) });
  }
};
