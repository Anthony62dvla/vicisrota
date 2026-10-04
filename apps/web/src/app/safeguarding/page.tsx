import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc, eq } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { CONCERN_LABEL, CONCERN_STATUS_LABEL } from "@/lib/concern-labels";
import { ConcernActionForm } from "./action-form";
import { raiseConcernAsManager } from "./actions";
import { ConcernForm } from "./concern-form";
import { OutsideHelp } from "./guidance";

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function SafeguardingPage() {
  const { organisationId, sector  } = await requireManager();
  const { concerns, actions, clients } = await withOrganisation(db, organisationId, async (tx) => ({
    concerns: await tx
      .select({ concern: schema.safeguardingConcern, clientName: schema.client.name })
      .from(schema.safeguardingConcern)
      .leftJoin(schema.client, eq(schema.safeguardingConcern.clientId, schema.client.id))
      .orderBy(desc(schema.safeguardingConcern.createdAt)),
    actions: await tx.select().from(schema.safeguardingAction).orderBy(asc(schema.safeguardingAction.createdAt)),
    clients: await tx.select({ id: schema.client.id, name: schema.client.name }).from(schema.client).where(eq(schema.client.active, true)).orderBy(asc(schema.client.name)),
  }));
  const open = concerns.filter((c) => c.concern.status !== "closed");
  const closed = concerns.filter((c) => c.concern.status === "closed");

  const card = ({ concern: c, clientName }: (typeof concerns)[number]) => {
    const log = actions.filter((a) => a.concernId === c.id);
    return (
      <li key={c.id} className={`rounded-lg border p-4 ${c.immediateDanger && c.status === "open" ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}>
        <p className="font-medium">
          {CONCERN_LABEL[c.category]} · {CONCERN_STATUS_LABEL[c.status]}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Raised {dateTimeFmt.format(c.createdAt)} by {c.raisedByName ?? "someone who chose not to give their name"}
          {c.happenedOn && <>. Happened {dateFmt.format(new Date(c.happenedOn))}</>}
        </p>
        {c.immediateDanger && <p className="mt-1 font-medium">They said someone may be in danger right now.</p>}
        {(clientName || c.aboutPerson) && <p className="mt-1">About: {[clientName, c.aboutPerson].filter(Boolean).join(", ")}</p>}
        <blockquote className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">{c.details}</blockquote>
        {log.length > 0 && (
          <ol className="mt-3 flex flex-col gap-2 border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
            {log.map((a) => (
              <li key={a.id}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {dateTimeFmt.format(a.createdAt)}, {a.actorName ?? "a former manager"}
                  {a.referredTo && <> · referred to {a.referredTo}</>}
                </p>
                <p className="whitespace-pre-wrap">{a.note}</p>
              </li>
            ))}
          </ol>
        )}
        <details className="mt-3">
          <summary className="cursor-pointer underline">Add a note, referral or status</summary>
          <ConcernActionForm concernId={c.id} status={c.status} />
        </details>
      </li>
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Safeguarding</h1>
      <p className="mt-1">
        Concerns raised by staff and managers. What was reported cannot be changed or deleted. Everything you do about it is added to its
        record, so there is a clear history if it is ever reviewed.
      </p>

      <section className="mt-8" aria-labelledby="open-heading">
        <h2 id="open-heading" className="text-lg font-semibold">Open concerns ({open.length})</h2>
        {open.length === 0 ? <p className="mt-2">No open concerns.</p> : <ul className="mt-3 flex flex-col gap-4">{open.map(card)}</ul>}
      </section>

      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-lg font-semibold">Closed concerns ({closed.length})</summary>
          <ul className="mt-3 flex flex-col gap-4">{closed.map(card)}</ul>
        </details>
      )}

      <section className="mt-10" aria-labelledby="raise-heading">
        <h2 id="raise-heading" className="text-lg font-semibold">Record a concern</h2>
        <OutsideHelp sector={sector} />
        <ConcernForm action={raiseConcernAsManager} clients={sector === "care" ? clients : []} allowAnonymous={false} />
      </section>
    </main>
  );
}
