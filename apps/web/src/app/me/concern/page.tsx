import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { CONCERN_LABEL, CONCERN_STATUS_LABEL } from "@/lib/concern-labels";
import { myClientIds } from "@/lib/safeguarding";
import { ConcernForm } from "../../safeguarding/concern-form";
import { OutsideHelp } from "../../safeguarding/guidance";
import { raiseConcernAsStaff } from "./actions";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

export default async function RaiseConcernPage() {
  const { user, organisationId, businessName, worker } = await requireStaff();
  const ids = [...(await myClientIds(organisationId, worker.id))];
  const { clients, mine, sector } = await withOrganisation(db, organisationId, async (tx) => ({
    clients: ids.length ? await tx.select({ id: schema.client.id, name: schema.client.name }).from(schema.client).where(inArray(schema.client.id, ids)) : [],
    // Only concerns raised with a name; anonymous ones cannot be linked back to anyone.
    mine: await tx
      .select({ id: schema.safeguardingConcern.id, category: schema.safeguardingConcern.category, status: schema.safeguardingConcern.status, createdAt: schema.safeguardingConcern.createdAt })
      .from(schema.safeguardingConcern)
      .where(eq(schema.safeguardingConcern.raisedByUserId, user.id))
      .orderBy(desc(schema.safeguardingConcern.createdAt)),
    sector: (await tx.select({ sector: schema.organisation.sector }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]?.sector ?? "small_business",
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <p>
        <Link href="/me" className="underline">Back to your shifts</Link> · {businessName}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Raise a concern</h1>
      <p className="mt-2">
        If something worries you about someone&apos;s safety or wellbeing, or about how things are done at work, tell us here. Only managers
        can read it. What you write is kept exactly as you wrote it.
      </p>
      <OutsideHelp sector={sector} />

      <section className="mt-8" aria-labelledby="form-heading">
        <h2 id="form-heading" className="text-lg font-semibold">Your concern</h2>
        <ConcernForm action={raiseConcernAsStaff} clients={clients} allowAnonymous />
      </section>

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-lg font-semibold">Concerns you have raised</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {mine.map((c) => (
              <li key={c.id}>
                {dateFmt.format(c.createdAt)}: {CONCERN_LABEL[c.category]}. <strong>{CONCERN_STATUS_LABEL[c.status]}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
