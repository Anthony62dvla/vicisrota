import { addDays, weekStart } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { deleteRotaPattern } from "./actions";
import { FillForm, SavePatternForm } from "./forms";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function PatternsPage({ searchParams }: PageProps<"/rota/patterns">) {
  const { organisationId } = await requireManager();
  const requested = (await searchParams).week;
  const thisWeek = weekStart(todayInUk());
  const week = weekStart(typeof requested === "string" && DATE.test(requested) ? requested : thisWeek);
  const { patterns, slots, workers, roles } = await withOrganisation(db, organisationId, async (tx) => ({
    patterns: await tx.select().from(schema.rotaPattern).orderBy(asc(schema.rotaPattern.name)),
    slots: await tx
      .select()
      .from(schema.rotaPatternShift)
      .orderBy(asc(schema.rotaPatternShift.weekIndex), asc(schema.rotaPatternShift.weekday), asc(schema.rotaPatternShift.startTime)),
    workers: await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker),
    roles: await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
  }));
  const workerName = new Map(workers.map((w) => [w.id, w.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p>
        <Link href={`/rota?week=${week}`} className="text-sm text-muted underline">Back to the rota</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Rota patterns</h1>
      <p className="mt-2">
        If your rota is the same each week, or rotates every two to four weeks, save it once as a pattern. Then fill the weeks ahead from it
        in one go. Everything is added as drafts, so nothing changes for staff until you check and publish each week.
      </p>

      <section className="mt-8" aria-labelledby="patterns-heading">
        <h2 id="patterns-heading" className="text-lg font-semibold">Your patterns</h2>
        {patterns.length === 0 ? (
          <p className="mt-2">No patterns yet. Save one below from a week you have already planned.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-4">
            {patterns.map((p) => {
              const mine = slots.filter((s) => s.patternId === p.id);
              const people = new Set(mine.map((s) => s.workerId).filter(Boolean)).size;
              const open = mine.filter((s) => !s.workerId).length;
              return (
                <li key={p.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-sm">
                    {p.weeks === 1 ? "Every week" : `Rotates every ${p.weeks} weeks`} · {mine.length} shift{mine.length === 1 ? "" : "s"} · {people}{" "}
                    {people === 1 ? "person" : "people"}
                    {open > 0 && ` · ${open} open`}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer underline">See the shifts</summary>
                    <ul className="mt-2 text-sm">
                      {mine.map((s) => (
                        <li key={s.id}>
                          {p.weeks > 1 && `Week ${s.weekIndex + 1}, `}
                          {DAYS[s.weekday]} {s.startTime} to {s.endTime}
                          {s.endsNextDay && " next day"}: {s.workerId ? (workerName.get(s.workerId) ?? "Someone") : "Open shift"}
                          {s.roleId && roleName.has(s.roleId) && ` (${roleName.get(s.roleId)})`}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <FillForm patternId={p.id} weeks={p.weeks} nextWeek={addDays(thisWeek, 7)} />
                  <form action={deleteRotaPattern} className="mt-3">
                    <input type="hidden" name="patternId" value={p.id} />
                    <button type="submit" className="text-sm underline">Delete this pattern</button>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400"> Shifts already on the rota stay.</span>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="save-heading">
        <h2 id="save-heading" className="text-lg font-semibold">Save a pattern</h2>
        <p className="mt-1">Plan the week, or weeks, on the rota first. Drafts are fine. Then save them here.</p>
        <SavePatternForm week={week} />
      </section>

      <section className="mt-10 rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-semibold">Good to know</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Shifts keep their clock times when the clocks change, so 22:00 to 08:00 stays 22:00 to 08:00.</li>
          <li>A shift already on the rota for the same person at the same time is skipped, so filling twice adds nothing.</li>
          <li>If someone is on approved leave or off sick that day, their shift is added as an open shift so you can find cover.</li>
          <li>The rota check still runs when you publish, including rest breaks, availability and agreed adjustments.</li>
        </ul>
      </section>
    </main>
  );
}
