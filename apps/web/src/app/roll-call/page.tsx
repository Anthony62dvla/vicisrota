import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { activeRollCall, peopleOnSite } from "@/lib/roll-call";
import { AutoRefresh } from "../lone-working/forms";
import { addToRollCall, endRollCall, markSafe, startRollCall } from "./actions";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default async function RollCallPage() {
  const { organisationId } = await requireManager();
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const call = await activeRollCall(tx);
    if (!call) {
      return {
        call,
        onSite: await peopleOnSite(tx, new Date().getTime()),
        past: await tx.select().from(schema.rollCall).where(isNotNull(schema.rollCall.endedAt)).orderBy(desc(schema.rollCall.startedAt)).limit(5),
        pastPeople: await tx.select({ rollCallId: schema.rollCallPerson.rollCallId, safeAt: schema.rollCallPerson.safeAt }).from(schema.rollCallPerson),
        people: [],
        staff: [],
      };
    }
    return {
      call,
      onSite: [],
      past: [],
      pastPeople: [],
      people: await tx
        .select({ person: schema.rollCallPerson, name: schema.worker.fullName })
        .from(schema.rollCallPerson)
        .innerJoin(schema.worker, eq(schema.worker.id, schema.rollCallPerson.workerId))
        .where(eq(schema.rollCallPerson.rollCallId, call.id))
        .orderBy(asc(schema.worker.fullName)),
      staff: await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).where(isNull(schema.worker.leftOn)).orderBy(asc(schema.worker.fullName)),
    };
  });

  if (!data.call) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
        <h1 className="text-2xl font-semibold">Fire roll call</h1>
        <p className="mt-1">
          In a fire or other emergency, start a roll call once everyone is out. It lists everyone who should be on site, so you can tick each person off as
          safe. Staff can also tap &quot;I&apos;m safe&quot; on their phone.
        </p>
        <p className="mt-4 font-medium">
          {data.onSite.length === 0
            ? "Nobody is on site on the rota right now."
            : `${data.onSite.length === 1 ? "1 person" : `${data.onSite.length} people`} should be on site now.`}
        </p>
        <form action={startRollCall} className="mt-4">
          <button type="submit" className="rounded-lg bg-red-700 px-6 py-4 text-lg font-semibold text-white hover:bg-red-800">
            Start roll call
          </button>
        </form>
        {data.past.length > 0 && (
          <section className="mt-10" aria-labelledby="past-heading">
            <h2 id="past-heading" className="text-lg font-semibold">Recent roll calls</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Kept as a record, for example for fire drill logs.</p>
            <ul className="mt-2 flex flex-col gap-1">
              {data.past.map((c) => {
                const people = data.pastPeople.filter((p) => p.rollCallId === c.id);
                return (
                  <li key={c.id}>
                    {dateFmt.format(c.startedAt)} to {timeFmt.format(c.endedAt!)}: {people.filter((p) => p.safeAt).length} of {people.length} accounted for
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    );
  }

  const missing = data.people.filter((p) => !p.person.safeAt);
  const safe = data.people.filter((p) => p.person.safeAt);
  const listed = new Set(data.people.map((p) => p.person.workerId));
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <AutoRefresh seconds={10} />
      <h1 className="text-2xl font-semibold">Roll call in progress</h1>
      <p className="mt-1">Started at {timeFmt.format(data.call.startedAt)}. This page updates every 10 seconds, so people who tap &quot;I&apos;m safe&quot; appear here.</p>
      <p role="status" className={`mt-4 rounded-lg border-2 p-4 text-lg font-semibold ${missing.length ? "border-red-600" : "border-green-600"}`}>
        {missing.length === 0
          ? `Everyone is accounted for (${safe.length}).`
          : `${missing.length} not yet accounted for. ${safe.length} safe.`}
      </p>

      {missing.length > 0 && (
        <section className="mt-6" aria-labelledby="missing-heading">
          <h2 id="missing-heading" className="text-lg font-semibold">Not yet accounted for</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {missing.map(({ person: p, name }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                <span>
                  <span className="text-lg font-medium">{name}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {p.expected === "clocked_in" ? "Clocked in" : "On the rota now but not clocked in, so may not be here"}
                    {p.place && ` · ${p.place}`}
                  </span>
                </span>
                <form action={markSafe}>
                  <input type="hidden" name="personId" value={p.id} />
                  <button type="submit" className="rounded-lg bg-brand px-6 py-3 text-lg text-on-brand hover:bg-brand-hover">
                    Safe
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {safe.length > 0 && (
        <section className="mt-6" aria-labelledby="safe-heading">
          <h2 id="safe-heading" className="text-lg font-semibold">Safe</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {safe.map(({ person: p, name }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                <span>
                  {name}
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {p.markedBySelf ? "Said they are safe" : "Marked safe"} at {timeFmt.format(p.safeAt!)}
                  </span>
                </span>
                <form action={markSafe}>
                  <input type="hidden" name="personId" value={p.id} />
                  <input type="hidden" name="safe" value="false" />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1.5 text-sm">Undo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer underline">Add someone who is here but not on the list</summary>
        <form action={addToRollCall} className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Person</span>
            <select name="workerId" className="rounded-lg border border-zinc-400 px-3 py-2">
              {data.staff
                .filter((s) => !listed.has(s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Add</button>
        </form>
      </details>

      <form action={endRollCall} className="mt-10 border-t border-line pt-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">End the roll call when the emergency is over. It is kept as a record.</p>
        <button type="submit" className="mt-2 rounded-lg border border-zinc-400 px-4 py-2">End roll call</button>
      </form>
    </main>
  );
}
