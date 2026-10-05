import { schema, withOrganisation } from "@vicisrota/db";
import { QUIET_DEFAULT } from "@vicisrota/messaging";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { requireMember } from "@/lib/business";
import { db } from "@/lib/db";
import { myConversations, peopleInBusiness } from "@/lib/messages";
import { pushPublicKey } from "@/lib/push";
import { PushSwitch } from "../push-switch";
import { startDirect } from "./actions";
import { NewGroupForm, QuietHoursForm } from "./forms";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default async function MessagesPage() {
  const { user, organisationId, isManager } = await requireMember();
  const { conversations, people, quiet } = await withOrganisation(db, organisationId, async (tx) => ({
    conversations: await myConversations(tx, user.id),
    people: (await peopleInBusiness(tx, organisationId)).filter((p) => p.userId !== user.id),
    quiet: (
      await tx
        .select({ q: schema.membership.messageQuiet })
        .from(schema.membership)
        .where(and(eq(schema.membership.organisationId, organisationId), eq(schema.membership.userId, user.id)))
    )[0]?.q ?? {},
  }));
  const pushKey = pushPublicKey();
  const concernLink = isManager ? "/safeguarding" : "/me/concern";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <p className="mt-1">
        Talk to colleagues one to one, or in groups your manager sets up. Only the people in a conversation can read it. Managers cannot see
        conversations they are not in.
      </p>
      <p className="mt-2 text-sm text-muted">
        If you are worried about someone&rsquo;s safety, do not rely on a message. <Link href={concernLink} className="underline">Raise a concern</Link>{" "}
        or, in an emergency, call 999.
      </p>

      <section className="mt-8" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-lg font-semibold">Your conversations</h2>
        {conversations.length === 0 && <p className="mt-2">None yet. Start one below.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-brand-soft">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {c.isGroup ? `Group · ${c.people.length + 1} people` : "One to one"}
                    {c.lastMessageAt ? ` · ${when.format(c.lastMessageAt)}` : ""}
                  </span>
                </span>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-sm font-semibold text-on-brand">
                    {c.unread} new<span className="sr-only"> {c.unread === 1 ? "message" : "messages"}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-lg font-semibold">Message someone</h2>
        {people.length === 0 ? (
          <p className="mt-2">Nobody else has a VicisRota login in this business yet.</p>
        ) : (
          <form action={startDirect} className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span>Who</span>
              <select name="userId" className="rounded-lg border border-zinc-400 px-3 py-2">
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.name}
                    {p.role === "worker" ? "" : " (manager)"}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Open conversation</button>
          </form>
        )}
      </section>

      {isManager && people.length > 0 && (
        <section className="mt-10" aria-labelledby="group-heading">
          <h2 id="group-heading" className="text-lg font-semibold">Set up a group</h2>
          <p className="mt-1">You are added automatically. People added later can see earlier messages.</p>
          <NewGroupForm people={people} />
        </section>
      )}

      <section className="mt-10" aria-labelledby="quiet-heading">
        <h2 id="quiet-heading" className="text-lg font-semibold">Quiet hours</h2>
        <p className="mt-1">
          Time off is yours. During quiet hours you get no message notifications. Messages still arrive and are here when you next look.
        </p>
        <QuietHoursForm
          from={quiet.from === undefined ? QUIET_DEFAULT.from : quiet.from}
          to={quiet.to === undefined ? QUIET_DEFAULT.to : quiet.to}
          daysOff={quiet.daysOff ?? QUIET_DEFAULT.daysOff}
          isStaff={!isManager}
        />
        {pushKey && <PushSwitch publicKey={pushKey} />}
      </section>
    </main>
  );
}
