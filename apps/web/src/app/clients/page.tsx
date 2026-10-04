import { addDays, weekStart } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, isNotNull, lt, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { periodBounds } from "@/lib/payroll";
import { todayInUk } from "@/lib/rota";
import { setClientActive, setPaysTravelTime } from "./actions";
import { AddClientForm } from "./forms";

/** Visits to one person shared among more carers than this are flagged as poor continuity of care. */
const CONTINUITY_LIMIT = 4;

export default async function ClientsPage() {
  const { organisationId, sector  } = await requireManager();
  if (sector !== "care") redirect("/dashboard");
  const monday = weekStart(todayInUk());
  const { start, end } = periodBounds(monday, addDays(monday, 6));

  const { clients, visits, org } = await withOrganisation(db, organisationId, async (tx) => ({
    clients: await tx.select().from(schema.client).orderBy(asc(schema.client.name)),
    visits: await tx
      .select({ clientId: schema.shift.clientId, workerId: schema.shift.workerId })
      .from(schema.shift)
      .where(and(isNotNull(schema.shift.clientId), ne(schema.shift.status, "cancelled"), gte(schema.shift.startsAt, start), lt(schema.shift.startsAt, end))),
    org: (await tx.select({ paysTravelTime: schema.organisation.paysTravelTime }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0],
  }));
  const carers = (clientId: string) => new Set(visits.filter((v) => v.clientId === clientId && v.workerId).map((v) => v.workerId)).size;
  const visitCount = (clientId: string) => visits.filter((v) => v.clientId === clientId).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="mt-1">The people you visit. Add a visit from the rota by choosing who it is for.</p>

      <section className="mt-8" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-lg font-semibold">This week</h2>
        {clients.length === 0 ? (
          <p className="mt-2">No clients yet. Add the first below.</p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2">Name</th>
                <th className="py-2">Postcode</th>
                <th className="py-2">Visits</th>
                <th className="py-2">Different carers</th>
                <th className="py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const n = carers(c.id);
                return (
                  <tr key={c.id} className={`border-b border-zinc-200 dark:border-zinc-800 ${c.active ? "" : "text-zinc-500"}`}>
                    <td className="py-2">{c.name}{!c.active && " (no longer visited)"}</td>
                    <td className="py-2">{c.postcode ?? "Not set"}</td>
                    <td className="py-2">{visitCount(c.id)}</td>
                    <td className="py-2">
                      {n}
                      {n > CONTINUITY_LIMIT && <span className="block text-sm font-semibold">More carers than usual: consider a smaller team</span>}
                    </td>
                    <td className="py-2 text-right">
                      <form action={setClientActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(!c.active)} />
                        <button type="submit" className="text-sm underline">{c.active ? "Stop visits" : "Restart visits"}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Seeing the same small team helps people feel safe, especially people living with dementia or who are autistic.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="travel-heading">
        <h2 id="travel-heading" className="text-lg font-semibold">Travel time</h2>
        <p className="mt-2">
          {org?.paysTravelTime
            ? "You pay travel between visits at the hourly rate. Travel time is added to pay in timesheets."
            : "You do not pay travel time separately. The rota check makes sure each carer's hourly rate still covers the minimum wage once travel between visits is counted."}
        </p>
        <form action={setPaysTravelTime} className="mt-3">
          <input type="hidden" name="paysTravelTime" value={String(!org?.paysTravelTime)} />
          <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">
            {org?.paysTravelTime ? "We do not pay travel time separately" : "We pay travel time at the hourly rate"}
          </button>
        </form>
      </section>

      <section className="mt-10" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold">Add a client</h2>
        <AddClientForm />
      </section>
    </main>
  );
}
