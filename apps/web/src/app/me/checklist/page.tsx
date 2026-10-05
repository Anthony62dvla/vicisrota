import { addDays, londonDateTime } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { HANDOVER_MAX, handoversFor, loadShiftTasks } from "@/lib/checklists";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { HandoverForm, TickList } from "./forms";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const whenFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Today's shifts, each with its checklists, the handover notes left for it and a place to leave one. */
export default async function ChecklistPage() {
  const { organisationId, worker } = await requireStaff();
  const today = todayInUk();
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select({ shift: schema.shift, role: schema.jobRole.name, place: schema.location.name })
      .from(schema.shift)
      .leftJoin(schema.jobRole, eq(schema.shift.roleId, schema.jobRole.id))
      .leftJoin(schema.location, eq(schema.shift.locationId, schema.location.id))
      .where(
        and(
          eq(schema.shift.workerId, worker.id),
          eq(schema.shift.status, "published"),
          // Today's shifts, including a night shift that started yesterday evening.
          gte(schema.shift.endsAt, new Date(londonDateTime(today, "00:00"))),
          lt(schema.shift.startsAt, new Date(londonDateTime(addDays(today, 1), "00:00"))),
        ),
      )
      .orderBy(asc(schema.shift.startsAt));
    const tasks = await loadShiftTasks(tx, shifts.map((s) => s.shift));
    const handovers = new Map(await Promise.all(shifts.map(async (s) => [s.shift.id, await handoversFor(tx, s.shift, worker.id)] as const)));
    return { shifts, tasks, handovers };
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/me" className="underline">My shifts</Link>
      <h1 className="mt-2 text-2xl font-semibold">Today&rsquo;s checklist and handover</h1>
      {data.shifts.length === 0 && <p className="mt-4">You have no shifts today. Enjoy your time off.</p>}
      {data.shifts.map(({ shift, role, place }) => {
        const lists = data.tasks.get(shift.id) ?? [];
        const notes = data.handovers.get(shift.id) ?? [];
        return (
          <section key={shift.id} className="mt-8" aria-labelledby={`shift-${shift.id}`}>
            <h2 id={`shift-${shift.id}`} className="text-xl font-semibold">
              {timeFmt.format(shift.startsAt)} to {timeFmt.format(shift.endsAt)}
              {role || place ? <span className="block text-base font-normal text-muted">{[role, place].filter(Boolean).join(" at ")}</span> : null}
            </h2>

            <h3 className="mt-4 font-semibold">Handover for you</h3>
            {notes.length === 0 ? (
              <p className="mt-1 text-muted">No notes left for this shift.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-brand bg-brand-soft p-3">
                    <p className="text-sm text-muted">From {n.by ?? "a colleague"}, {whenFmt.format(n.createdAt)}</p>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {lists.length === 0 ? (
              <p className="mt-4 text-muted">No checklist for this shift.</p>
            ) : (
              lists.map(({ template, ticked }) => (
                <div key={template.id} className="mt-6">
                  <h3 className="font-semibold">{template.name}</h3>
                  <TickList shiftId={shift.id} templateId={template.id} items={template.items} done={[...ticked.keys()]} />
                </div>
              ))
            )}

            <div className="mt-6">
              <HandoverForm shiftId={shift.id} max={HANDOVER_MAX} />
            </div>
          </section>
        );
      })}
    </main>
  );
}
