import { schema, withOrganisation } from "@vicisrota/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { RoleBadge } from "../role-badge";
import { removeRole } from "./actions";
import { suggestionsFor } from "@/lib/role-suggestions";
import { packById } from "@/lib/sector-packs";
import { AddRoleForm, SuggestedRolesForm } from "./forms";

export default async function RolesPage() {
  const { organisationId, sector, kind } = await requireManager();
  const { roles, links, workers } = await withOrganisation(db, organisationId, async (tx) => ({
    roles: await tx.select().from(schema.jobRole).orderBy(asc(schema.jobRole.name)),
    links: await tx.select().from(schema.workerRole),
    workers: await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).orderBy(asc(schema.worker.fullName)),
  }));
  const name = new Map(workers.map((w) => [w.id, w.name]));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Job roles</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Give shifts a role so everyone can see who is on the kitchen, the bar or the senior round. Open shifts are only offered to people who can do the role. The rota warns you if someone is put on a role they are not set up for. Roles are optional.
      </p>

      <section className="mt-8" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="text-lg font-semibold">Your roles</h2>
        {roles.length === 0 ? (
          <p className="mt-2">No roles yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {roles.map((r) => {
              const people = links.filter((l) => l.roleId === r.id).map((l) => name.get(l.workerId)).filter(Boolean);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                  <div>
                    <RoleBadge name={r.name} colour={r.colour} />
                    <p className="mt-1 text-sm">{people.length ? people.join(", ") : "Nobody set up for this role yet."}</p>
                  </div>
                  <form action={removeRole}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Remove role</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          To say who can work a role, open their record on the <Link href="/staff" className="underline">Staff page</Link>.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="suggested-heading">
        <h2 id="suggested-heading" className="text-lg font-semibold">Choose from common roles</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Tick the roles you use, then add them all at once. You can remove any you do not need later.</p>
        <SuggestedRolesForm groups={suggestionsFor(sector, packById(kind)?.roleGroup)} have={roles.map((r) => r.name)} />
      </section>

      <section className="mt-8" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold">Add your own role</h2>
        <AddRoleForm />
      </section>
    </main>
  );
}
