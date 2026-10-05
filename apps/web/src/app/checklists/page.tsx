import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { loadShiftTasks } from "@/lib/checklists";
import { db } from "@/lib/db";
import { archiveChecklist } from "./actions";
import { ChecklistForm } from "./forms";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default async function ChecklistsPage() {
  const { organisationId } = await requireManager();
  const now = new Date().getTime();
  const since = new Date(now - 7 * 86_400_000);
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const roles = await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole).orderBy(asc(schema.jobRole.name));
    const places = await tx.select({ id: schema.location.id, name: schema.location.name }).from(schema.location).orderBy(asc(schema.location.name));
    const templates = await tx.select().from(schema.checklistTemplate).where(isNull(schema.checklistTemplate.archivedAt)).orderBy(asc(schema.checklistTemplate.name));
    const shifts = await tx
      .select({ shift: schema.shift, name: schema.worker.fullName })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .where(and(eq(schema.shift.status, "published"), gte(schema.shift.startsAt, since), lt(schema.shift.startsAt, new Date(now))))
      .orderBy(desc(schema.shift.startsAt));
    const tasks = await loadShiftTasks(tx, shifts.map((s) => s.shift));
    const handovers = await tx
      .select({ id: schema.handover.id, body: schema.handover.body, createdAt: schema.handover.createdAt, by: schema.worker.fullName, place: schema.location.name })
      .from(schema.handover)
      .leftJoin(schema.worker, eq(schema.handover.workerId, schema.worker.id))
      .leftJoin(schema.location, eq(schema.handover.locationId, schema.location.id))
      .where(gte(schema.handover.createdAt, since))
      .orderBy(desc(schema.handover.createdAt));
    return { roles, places, templates, shifts, tasks, handovers };
  });
  const roleName = new Map(data.roles.map((r) => [r.id, r.name]));
  const placeName = new Map(data.places.map((p) => [p.id, p.name]));
  const checked = data.shifts
    .map((s) => {
      const lists = data.tasks.get(s.shift.id) ?? [];
      const total = lists.reduce((n, l) => n + l.template.items.length, 0);
      const done = lists.reduce((n, l) => n + l.ticked.size, 0);
      return { ...s, total, done };
    })
    .filter((s) => s.total > 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Checklists and handovers</h1>
      <p className="mt-1">
        Tasks for each shift, such as opening and closing checks, which staff tick off on their phone. At the end of a shift they can leave a
        handover note for the next people at the same workplace.
      </p>

      <section className="mt-8" aria-labelledby="lists-heading">
        <h2 id="lists-heading" className="text-lg font-semibold">Your checklists</h2>
        {data.templates.length === 0 && <p className="mt-2">None yet.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {data.templates.map((t) => (
            <li key={t.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-sm text-muted">
                    {t.roleId ? roleName.get(t.roleId) : "Any role"} · {t.locationId ? placeName.get(t.locationId) : "any workplace"}
                  </p>
                </div>
                <form action={archiveChecklist}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1.5 text-sm">Stop using</button>
                </form>
              </div>
              <ol className="mt-2 list-decimal pl-6">
                {t.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-lg font-semibold">New checklist</h2>
        <ChecklistForm roles={data.roles} places={data.places} />
      </section>

      <section className="mt-10" aria-labelledby="done-heading">
        <h2 id="done-heading" className="text-lg font-semibold">Last 7 days</h2>
        {checked.length === 0 ? (
          <p className="mt-2">No shifts with checklists yet.</p>
        ) : (
          <table className="mt-3 w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Shift</th>
                <th className="py-2 pr-3">Who</th>
                <th className="py-2">Done</th>
              </tr>
            </thead>
            <tbody>
              {checked.map((s) => (
                <tr key={s.shift.id} className="border-b border-line">
                  <td className="py-2 pr-3">{when.format(s.shift.startsAt)}</td>
                  <td className="py-2 pr-3">{s.name}</td>
                  <td className="py-2">
                    {s.done} of {s.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-10" aria-labelledby="handover-heading">
        <h2 id="handover-heading" className="text-lg font-semibold">Handover notes, last 7 days</h2>
        {data.handovers.length === 0 && <p className="mt-2">None yet.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {data.handovers.map((h) => (
            <li key={h.id} className="rounded-lg border p-3">
              <p className="text-sm text-muted">
                {h.by ?? "Someone who has left"}
                {h.place ? ` at ${h.place}` : ""}, {when.format(h.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{h.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
