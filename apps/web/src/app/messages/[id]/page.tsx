import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/business";
import { db } from "@/lib/db";
import { MESSAGE_MAX, openConversation, peopleInBusiness } from "@/lib/messages";
import { GroupMembersForm, LiveConversation, MessageForm } from "../forms";

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The last 200 messages are shown; older ones are kept. */
const SHOWN = 200;

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, organisationId, isManager } = await requireMember();
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const conversation = await openConversation(tx, id, user.id);
    if (!conversation) return null;
    const members = await tx
      .select({ userId: schema.conversationMember.userId, name: schema.user.name })
      .from(schema.conversationMember)
      .innerJoin(schema.user, eq(schema.conversationMember.userId, schema.user.id))
      .where(eq(schema.conversationMember.conversationId, id))
      .orderBy(asc(schema.user.name));
    const messages = (
      await tx
        .select({ id: schema.message.id, body: schema.message.body, createdAt: schema.message.createdAt, senderUserId: schema.message.senderUserId, sender: schema.user.name })
        .from(schema.message)
        .leftJoin(schema.user, eq(schema.message.senderUserId, schema.user.id))
        .where(eq(schema.message.conversationId, id))
        .orderBy(desc(schema.message.createdAt))
        .limit(SHOWN)
    ).reverse();
    const people = conversation.name && isManager ? await peopleInBusiness(tx, organisationId) : [];
    return { conversation, members, messages, people };
  });
  if (!data) notFound();
  const { conversation, members, messages } = data;
  const others = members.filter((m) => m.userId !== user.id);
  const title = conversation.name ?? others[0]?.name ?? "Just you";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <Link href="/messages" className="underline">All messages</Link>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-muted">
        {conversation.name ? `Group: ${members.map((m) => (m.userId === user.id ? "you" : m.name)).join(", ")}` : "Only the two of you can read this."}
      </p>

      <ol className="mt-6 flex flex-col gap-3" aria-label="Messages">
        {messages.length === 0 && <li>No messages yet. Write the first one below.</li>}
        {messages.map((m, i) => {
          const day = dayFmt.format(m.createdAt);
          const showDay = i === 0 || day !== dayFmt.format(messages[i - 1]!.createdAt);
          const mine = m.senderUserId === user.id;
          return (
            <li key={m.id} className="flex flex-col">
              {showDay && <p className="my-2 text-center text-sm font-medium text-muted">{day}</p>}
              <div className={`max-w-[85%] rounded-xl border p-3 ${mine ? "self-end border-brand bg-brand-soft" : "self-start"}`}>
                <p className="text-sm text-muted">
                  {mine ? "You" : (m.sender ?? "Someone who has left")} · {timeFmt.format(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <MessageForm conversationId={conversation.id} max={MESSAGE_MAX} />
      </div>
      <LiveConversation conversationId={conversation.id} latest={messages.at(-1)?.createdAt.getTime() ?? 0} />

      {conversation.name && isManager && (
        <details className="mt-10 rounded-lg border p-4">
          <summary className="font-medium">Change who is in this group</summary>
          <GroupMembersForm conversationId={conversation.id} people={data.people.filter((p) => p.userId !== user.id)} members={members.map((m) => m.userId)} />
        </details>
      )}
    </main>
  );
}
