import { STAFFING_LEGAL_REF } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { loadStaffingLevels, WEEKDAYS } from "@/lib/staffing";
import { removeStaffingLevel } from "./actions";
import { AddStaffingLevelForm } from "./forms";

const days = (weekdays: number[]) => {
  const key = [...weekdays].sort().join("");
  if (key === "1234567") return "Every day";
  if (key === "12345") return "Monday to Friday";
  if (key === "67") return "Weekends";
  return weekdays.map((d) => WEEKDAYS[d - 1]).join(", ");
};

const hours = (from: string, to: string) => {
  if (from === to || (from === "00:00" && to === "24:00")) return from === "00:00" ? "all day" : `all day from ${from}`;
  const end = to === "24:00" ? "midnight" : to;
  return to !== "24:00" && to < from ? `${from} to ${end} the next morning` : `${from} to ${end}`;
};

/** The fewest people the business needs on, by workplace, role and time. The rota is checked against these every week. */
export default async function StaffingPage() {
  const { organisationId } = await requireManager();
  const { levels, workplaces, roles } = await withOrganisation(db, organisationId, async (tx) => ({
    levels: await loadStaffingLevels(tx),
    workplaces: await tx.select({ id: schema.location.id, name: schema.location.name }).from(schema.location).orderBy(asc(schema.location.name)),
    roles: await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole).orderBy(asc(schema.jobRole.name)),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Safe staffing</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Set the fewest people you need on at each time. The <Link href="/rota" className="underline">rota</Link> shows any time that falls short, and can
        stop a rota going out until it is covered. Open shifts nobody has taken do not count.
      </p>
      <p className="mt-2 text-sm text-muted">Why this matters in care: {STAFFING_LEGAL_REF}</p>

      <section className="mt-8" aria-labelledby="levels-heading">
        <h2 id="levels-heading" className="text-lg font-semibold">Your staffing levels</h2>
        {levels.length === 0 ? (
          <p className="mt-2">None set yet. Add your first below.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {levels.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <div>
                  <p className="font-medium">
                    {l.place}: at least {l.minPeople} {l.roleId ? `${l.roleName ?? "of the role"}${l.minPeople === 1 ? "" : "s"}` : l.minPeople === 1 ? "person" : "people"}
                  </p>
                  <p className="text-sm text-muted">
                    {days(l.weekdays)}, {hours(l.from, l.to)}. {l.strict ? "The rota cannot go out if it falls short." : "Shows a reminder if it falls short."}
                  </p>
                </div>
                <form action={removeStaffingLevel}>
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="rounded-lg border border-zinc-500 px-3 py-1.5 text-sm">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold">Add a staffing level</h2>
        <AddStaffingLevelForm workplaces={workplaces} roles={roles} />
      </section>
    </main>
  );
}
