import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, loadBalances } from "@/lib/leave";
import { todayInUk } from "@/lib/rota";
import { contactSummary, PROFILE_QUESTIONS } from "@/lib/work-profile";
import { AvailabilityEditor } from "../../availability-editor";
import { addStaffUnavailable, removeStaffUnavailable, removeTraining } from "./actions";
import { formatUkMobile } from "@vicisrota/messaging";
import { WorkerRolesForm } from "../../roles/forms";
import { AddCheckForm, AddTrainingForm, AdjustmentsForm, HolidaySettingsForm, InviteForm, MobileForm } from "./forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DBS_LABEL = { basic: "Basic", standard: "Standard", enhanced: "Enhanced", enhanced_barred: "Enhanced with barred list" };
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default async function StaffRecordPage({ params }: PageProps<"/staff/[id]">) {
  const { organisationId } = await requireManager();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const today = todayInUk();

  const data = await withOrganisation(db, organisationId, async (tx) => {
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.id, id));
    if (!worker) return null;
    return {
      worker,
      checks: await tx.select().from(schema.workerCheck).where(eq(schema.workerCheck.workerId, id)).orderBy(desc(schema.workerCheck.checkedOn)),
      training: await tx
        .select({ id: schema.workerQualification.id, name: schema.qualification.name, achievedOn: schema.workerQualification.achievedOn, expiresOn: schema.workerQualification.expiresOn })
        .from(schema.workerQualification)
        .innerJoin(schema.qualification, eq(schema.workerQualification.qualificationId, schema.qualification.id))
        .where(eq(schema.workerQualification.workerId, id))
        .orderBy(asc(schema.qualification.name)),
      holiday: await loadBalances(tx, organisationId, today),
      login: worker.userId
        ? (await tx.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, worker.userId)))[0]
        : undefined,
      unavailable: await tx
        .select()
        .from(schema.workerUnavailability)
        .where(eq(schema.workerUnavailability.workerId, id))
        .orderBy(asc(schema.workerUnavailability.weekday), asc(schema.workerUnavailability.startsAt)),
      roles: await tx.select().from(schema.jobRole).orderBy(asc(schema.jobRole.name)),
      held: (await tx.select({ roleId: schema.workerRole.roleId }).from(schema.workerRole).where(eq(schema.workerRole.workerId, id))).map((r) => r.roleId),
      known: (await tx.select({ name: schema.qualification.name }).from(schema.qualification).orderBy(asc(schema.qualification.name))).map((q) => q.name),
    };
  });
  if (!data) notFound();
  const { worker, checks, training, known, holiday, login, unavailable, roles, held } = data;
  const balance = holiday.balances.get(worker.id)!;
  const rtw = checks.filter((c) => c.kind === "right_to_work");
  const dbs = checks.filter((c) => c.kind === "dbs");
  const hasValidRtw = rtw.some((c) => c.checkedOn <= today && (!c.expiresOn || c.expiresOn >= today));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/staff" className="text-sm text-muted underline">All staff</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{worker.fullName}</h1>

      <section id="roles" className="mt-8 scroll-mt-4" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="text-lg font-semibold">Job roles</h2>
        {roles.length === 0 ? (
          <p className="mt-2">
            Your business has no job roles yet. <Link href="/roles" className="underline">Add roles</Link> such as Chef or Senior carer if you want
            them on the rota.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">The roles {worker.fullName} can work. Open shifts are only offered for these.</p>
            <WorkerRolesForm workerId={worker.id} roles={roles} held={held} />
          </>
        )}
      </section>

      <section id="mobile" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">Mobile number</h2>
        <MobileForm workerId={worker.id} mobile={worker.mobile ? formatUkMobile(worker.mobile) : null} />
      </section>

      <section id="login" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">Login</h2>
        {login ? (
          <p className="mt-2">{worker.fullName} logs in as {login.email} and can see their own shifts and ask for time off.</p>
        ) : (
          <>
            <p className="mt-2">
              Give {worker.fullName} their own login to see their shifts, add them to their phone calendar and ask for time off.
              They only ever see their own information.
            </p>
            <InviteForm workerId={worker.id} name={worker.fullName} mobile={worker.mobile ? formatUkMobile(worker.mobile) : null} />
          </>
        )}
      </section>

      <section id="availability" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">Times they can&apos;t work</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {worker.userId ? `${worker.fullName} can also add these on their own page.` : "Add these with them, for example school runs, caring or another job."} The rota check
          warns if a shift clashes.
        </p>
        <AvailabilityEditor slots={unavailable} add={addStaffUnavailable} remove={removeStaffUnavailable} workerId={worker.id} you={false} />
      </section>

      <section id="work-best" className="mt-8 scroll-mt-4" aria-labelledby="work-best-heading">
        <h2 id="work-best-heading" className="text-lg font-semibold">How {worker.fullName} works best</h2>
        <WorkProfileView name={worker.fullName} profile={worker.workProfile} hasLogin={!!worker.userId} />
      </section>

      <section id="adjustments" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">Agreed adjustments</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Changes agreed with {worker.fullName} so they can work well, for example because of a disability, neurodivergence or a health condition. The rota
          check warns about any shift that does not fit. {worker.fullName} can see what is recorded here.
        </p>
        <AdjustmentsForm workerId={worker.id} current={worker.adjustments} />
      </section>

      <section id="right-to-work" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">Right to work</h2>
        {!hasValidRtw && (
          <p role="alert" className="mt-2 rounded-lg border border-red-400 p-3">
            No valid right to work check today. {worker.fullName} cannot be put on a published rota until one is recorded.
          </p>
        )}
        <ul className="mt-2 list-disc pl-6">
          {rtw.map((c) => (
            <li key={c.id}>
              Checked {ukDate(c.checkedOn)}
              {c.expiresOn ? `, follow-up check due ${ukDate(c.expiresOn)}` : ", no follow-up needed"}
              {c.expiresOn && c.expiresOn < today ? " (overdue)" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section id="dbs" className="mt-8 scroll-mt-4">
        <h2 className="text-lg font-semibold">DBS</h2>
        {dbs.length === 0 ? (
          <p className="mt-2">No DBS check recorded.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6">
            {dbs.map((c) => (
              <li key={c.id}>
                {c.dbsLevel ? DBS_LABEL[c.dbsLevel] : "DBS"}, checked {ukDate(c.checkedOn)}
              </li>
            ))}
          </ul>
        )}
        <AddCheckForm workerId={worker.id} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Training and qualifications</h2>
        {training.length === 0 ? (
          <p className="mt-2">No training recorded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {training.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <span>
                  {t.name}
                  {t.expiresOn && (t.expiresOn < today ? `, expired ${ukDate(t.expiresOn)}` : `, valid until ${ukDate(t.expiresOn)}`)}
                </span>
                <form action={removeTraining}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="workerId" value={worker.id} />
                  <button type="submit" className="underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddTrainingForm workerId={worker.id} known={known} />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Holiday</h2>
        <p className="mt-2">
          {formatAmount(balance.remaining, balance.unit)} left of {formatAmount(balance.entitlement, balance.unit)}
          {balance.unit === "hours" ? " built up so far" : ""} this leave year ({ukDate(holiday.year.start)} to {ukDate(holiday.year.end)}).
          {balance.requested > 0 && ` ${formatAmount(balance.requested, balance.unit)} waiting for a decision.`}{" "}
          <Link href="/leave" className="underline">Book leave</Link>
        </p>
        <HolidaySettingsForm
          workerId={worker.id}
          employmentStart={worker.employmentStart}
          daysPerWeek={worker.daysPerWeek}
          irregularHours={worker.irregularHours}
        />
      </section>
    </main>
  );
}

/** The person's own "How I work best", shown only while they choose to share it. */
function WorkProfileView({ name, profile, hasLogin }: { name: string; profile: typeof schema.worker.$inferSelect.workProfile; hasLogin: boolean }) {
  if (!profile.shared) {
    return (
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {hasLogin
          ? `${name} can write about what they bring, what helps them and how they like to be contacted, and choose to share it with you. They have not shared it, and that is their choice.`
          : `Once ${name} has a login, they can write about what helps them at work and choose to share it with you.`}
      </p>
    );
  }
  const answers = PROFILE_QUESTIONS.filter((q) => profile[q.key]);
  const contact = contactSummary(profile);
  return (
    <div className="mt-2 rounded-lg border border-brand p-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">In {name}&apos;s own words, shared by them. Please keep it private.</p>
      {contact && (
        <p className="mt-2">
          <span className="font-medium">Best way to contact them:</span> {contact}
        </p>
      )}
      <dl className="mt-2 flex flex-col gap-2">
        {answers.map((q) => (
          <div key={q.key}>
            <dt className="font-medium">{q.label}</dt>
            <dd className="whitespace-pre-line">{profile[q.key]}</dd>
          </div>
        ))}
      </dl>
      {!answers.length && !contact && <p className="mt-2">They have shared it but not written anything yet.</p>}
    </div>
  );
}
