import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { localeOf } from "@vicisrota/messaging";
import { messagesFor } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { myClientIds } from "@/lib/safeguarding";
import { ConcernForm } from "../../safeguarding/concern-form";
import { OutsideHelp } from "../../safeguarding/guidance";
import { raiseConcernAsStaff } from "./actions";


export default async function RaiseConcernPage() {
  const { user, organisationId, businessName, worker } = await requireStaff();
  const ids = [...(await myClientIds(organisationId, worker.id))];
  const lang = await getLang();
  const locale = localeOf(lang);
  const { concern: t, concernForm } = messagesFor(lang);
  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
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
    <main lang={locale} className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/me" className="underline">{t.back}</Link> · {businessName}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{t.title}</h1>
      <p className="mt-2">{t.intro}{lang === "en" ? "" : ` ${t.yourLanguage}`}</p>
      <OutsideHelp sector={sector} t={t} />

      <section className="mt-8" aria-labelledby="form-heading">
        <h2 id="form-heading" className="text-lg font-semibold">{t.form}</h2>
        <ConcernForm action={raiseConcernAsStaff} clients={clients} allowAnonymous t={concernForm} />
      </section>

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-lg font-semibold">{t.mine}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {mine.map((c) => (
              <li key={c.id}>
                {dateFmt.format(c.createdAt)}: {concernForm.categories[c.category]}. <strong>{t.status[c.status]}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
