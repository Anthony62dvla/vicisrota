import { courseSite } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { asc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { AddTrainingForm, CourseLinkForm } from "./forms";

/** The training a business tracks, and where staff can do each course. Staff see the links on their own page. */
export default async function TrainingPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { types, held } = await withOrganisation(db, organisationId, async (tx) => ({
    types: await tx.select().from(schema.qualification).orderBy(asc(schema.qualification.name)),
    held: await tx
      .select({ qualificationId: schema.workerQualification.qualificationId, workerId: schema.workerQualification.workerId, expiresOn: schema.workerQualification.expiresOn })
      .from(schema.workerQualification)
      .innerJoin(schema.worker, eq(schema.workerQualification.workerId, schema.worker.id))
      .where(isNull(schema.worker.leftOn)),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Training</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        The training your business keeps track of. Add a course link and your staff will see it on their own page, next to their training, so they know
        where to do it or renew it. To record who has done what, open their record on the <Link href="/staff" className="underline">Staff page</Link>.
      </p>

      <section className="mt-8" aria-labelledby="types-heading">
        <h2 id="types-heading" className="text-lg font-semibold">Your training</h2>
        {types.length === 0 ? (
          <p className="mt-2">No training yet. Add your first below.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {types.map((t) => {
              const records = held.filter((h) => h.qualificationId === t.id);
              const people = new Set(records.map((r) => r.workerId)).size;
              const expired = new Set(records.filter((r) => r.expiresOn && r.expiresOn < today).map((r) => r.workerId)).size;
              return (
                <li key={t.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted">
                    {people === 0 ? "Nobody recorded yet" : `${people} ${people === 1 ? "person has" : "people have"} it`}
                    {expired > 0 && `, ${expired} expired`}
                    {t.courseUrl && (
                      <>
                        {" · "}
                        <a href={t.courseUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          Open {courseSite(t.courseUrl)}
                        </a>
                      </>
                    )}
                  </p>
                  <CourseLinkForm id={t.id} name={t.name} courseUrl={t.courseUrl} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold">Add training</h2>
        <AddTrainingForm />
      </section>
    </main>
  );
}
