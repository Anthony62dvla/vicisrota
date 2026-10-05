import { schema, withOrganisation } from "@vicisrota/db";
import { and, desc, eq, gte, isNull, or } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { answerLabel } from "@/lib/wellbeing";
import { markChatHandled } from "./actions";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Wellbeing for managers: who would like a chat, and the check-ins people chose to share. Answers people
 * kept private are never shown or counted here.
 */
export default async function WellbeingPage() {
  const { organisationId } = await requireManager();
  const since = new Date(new Date().getTime() - 30 * 86_400_000);
  const { chats, shared } = await withOrganisation(db, organisationId, async (tx) => ({
    chats: await tx
      .select({ id: schema.wellbeingCheckIn.id, createdAt: schema.wellbeingCheckIn.createdAt, handledAt: schema.wellbeingCheckIn.chatHandledAt, name: schema.worker.fullName })
      .from(schema.wellbeingCheckIn)
      .innerJoin(schema.worker, eq(schema.wellbeingCheckIn.workerId, schema.worker.id))
      .where(and(eq(schema.wellbeingCheckIn.wantsChat, true), or(isNull(schema.wellbeingCheckIn.chatHandledAt), gte(schema.wellbeingCheckIn.createdAt, since))))
      .orderBy(desc(schema.wellbeingCheckIn.createdAt)),
    shared: await tx
      .select({ checkIn: schema.wellbeingCheckIn, name: schema.worker.fullName })
      .from(schema.wellbeingCheckIn)
      .innerJoin(schema.worker, eq(schema.wellbeingCheckIn.workerId, schema.worker.id))
      .where(and(eq(schema.wellbeingCheckIn.shared, true), gte(schema.wellbeingCheckIn.createdAt, since)))
      .orderBy(desc(schema.wellbeingCheckIn.createdAt)),
  }));
  const open = chats.filter((c) => !c.handledAt);
  const handled = chats.filter((c) => c.handledAt);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Wellbeing</h1>
      <p className="mt-1">
        Staff can turn on a short, private check-in after their shifts. They choose whether you see their answers. Anything they kept private
        is not shown or counted here.
      </p>

      <section className="mt-8" aria-labelledby="chat-heading">
        <h2 id="chat-heading" className="text-lg font-semibold">Would like a chat</h2>
        {open.length === 0 && <p className="mt-2">Nobody is waiting for a chat.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {open.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-warn p-3">
              <span>
                <span className="font-medium">{c.name}</span> asked on {when.format(c.createdAt)}
              </span>
              <form action={markChatHandled}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1.5">We have talked</button>
              </form>
            </li>
          ))}
        </ul>
        {handled.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Talked in the last 30 days: {handled.map((c) => `${c.name} (${when.format(c.handledAt!)})`).join(", ")}.
          </p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="shared-heading">
        <h2 id="shared-heading" className="text-lg font-semibold">Shared check-ins, last 30 days</h2>
        {shared.length === 0 && <p className="mt-2">None shared.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {shared.map(({ checkIn, name }) => (
            <li key={checkIn.id} className="rounded-lg border p-3">
              <p>
                <span className="font-medium">{name}</span>: {answerLabel(checkIn.answer)}
                <span className="text-muted"> · {when.format(checkIn.createdAt)}</span>
              </p>
              {checkIn.note && <p className="whitespace-pre-wrap">{checkIn.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
