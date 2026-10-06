import { CHILD_LEGAL_REF, isSchoolAge, NIGHT_HEALTH_LEGAL_REF, schoolLeavingDate, SUNDAY_LEGAL_REF, sundayOptOutFrom } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, loadBalances } from "@/lib/leave";
import { todayInUk } from "@/lib/rota";
import { contactSummary, PROFILE_QUESTIONS } from "@/lib/work-profile";
import { AvailabilityEditor } from "../../availability-editor";
import { addStaffUnavailable, removeKeepApart, removeStaffUnavailable, removeTraining } from "./actions";
import { formatUkMobile } from "@vicisrota/messaging";
import { WorkerRolesForm } from "../../roles/forms";
import { AddCheckForm, AddTrainingForm, AgencyForm, ChildPermitForm, NightHealthForm, AdjustmentsForm, HolidaySettingsForm, InviteForm, KeepApartForm, LeavingForm, MobileForm, PayrollIdForm, PersonalLicenceForm, SponsorshipForm, SundayOptOutForm, SupervisionForm } from "./forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DBS_LABEL = { basic: "Basic", standard: "Standard", enhanced: "Enhanced", enhanced_barred: "Enhanced with barred list" };
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export default async function StaffRecordPage({ params, searchParams }: PageProps<"/staff/[id]">) {
  const { organisationId, sector } = await requireManager();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const welcome = (await searchParams).welcome === "1";
  const today = todayInUk();

  const data = await withOrganisation(db, organisationId, async (tx) => {
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.id, id));
    if (!worker) return null;
    return {
      worker,
      checks: await tx.select().from(schema.workerCheck).where(eq(schema.workerCheck.workerId, id)).orderBy(desc(schema.workerCheck.checkedOn)),
      training: await tx
        .select({ id: schema.workerQualification.id, name: schema.qualification.name, achievedOn: schema.workerQualification.achievedOn, expiresOn: schema.workerQualification.expiresOn, reference: schema.workerQualification.reference, courseUrl: schema.qualification.courseUrl })
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
      supervisions: await tx.select().from(schema.supervision).where(eq(schema.supervision.workerId, id)).orderBy(desc(schema.supervision.heldOn)),
      apart: await tx
        .select()
        .from(schema.keepApart)
        .where(or(eq(schema.keepApart.firstWorkerId, id), eq(schema.keepApart.secondWorkerId, id))),
      colleagues: await tx
        .select({ id: schema.worker.id, name: schema.worker.fullName })
        .from(schema.worker)
        .where(and(ne(schema.worker.id, id), isNull(schema.worker.leftOn)))
        .orderBy(asc(schema.worker.fullName)),
      nightHealth: await tx.select().from(schema.nightHealthAssessment).where(eq(schema.nightHealthAssessment.workerId, id)).orderBy(desc(schema.nightHealthAssessment.offeredOn)),
      known: (await tx.select({ name: schema.qualification.name }).from(schema.qualification).orderBy(asc(schema.qualification.name))).map((q) => q.name),
    };
  });
  if (!data) notFound();
  const { worker, checks, training, known, holiday, login, unavailable, roles, held, supervisions, apart, colleagues, nightHealth } = data;
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
      {worker.leftOn && (
        <p role="status" className="mt-3 rounded-lg border border-line bg-brand-soft p-3">
          {worker.fullName} left on {worker.leftOn}. Their records are kept, but they are not put on rotas or counted in your price.{" "}
          <a href="#leaving" className="underline">Change this</a>
        </p>
      )}
      {welcome && (
        <div role="status" className="mt-4 rounded-lg border border-brand bg-brand-soft p-4">
          <p className="font-medium">{worker.fullName} has been added to your staff. Next steps:</p>
          <ol className="mt-2 list-decimal pl-5">
            <li><a href="#right-to-work" className="underline">Check their right to work</a> before their first shift. The law requires it.</li>
            {checks.length === 0 && <li><a href="#dbs" className="underline">Record a DBS check</a> if their role needs one.</li>}
            <li><a href="#roles" className="underline">Choose the roles</a> they will work.</li>
            <li><a href="#login" className="underline">Send them an invitation</a> so they can see their shifts on their phone.</li>
          </ol>
        </div>
      )}

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

      <section id="keep-apart" className="mt-8 scroll-mt-4" aria-labelledby="keep-apart-heading">
        <h2 id="keep-apart-heading" className="text-lg font-semibold">Kept apart on the rota</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          For example after a harassment complaint or a safeguarding concern, while it is looked into or for good. The rota check stops these people being
          on overlapping shifts at the same workplace. Only managers see this. Staff are never told, and if it stops them picking up or swapping a
          shift they get a general message.
        </p>
        {apart.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {apart.map((p) => {
              const otherId = p.firstWorkerId === worker.id ? p.secondWorkerId : p.firstWorkerId;
              const other = colleagues.find((c) => c.id === otherId)?.name ?? "Someone who has left";
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                  <span>
                    Kept apart from <strong>{other}</strong>
                    {p.reviewOn ? `, review on ${ukDate(p.reviewOn)}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <form action={removeKeepApart}>
                    <input type="hidden" name="workerId" value={worker.id} />
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="text-sm underline">Remove</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <KeepApartForm workerId={worker.id} others={colleagues} />
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

      {sector !== "care" && (
        <section id="personal-licence" className="mt-8 scroll-mt-4" aria-labelledby="personal-licence-heading">
          <h2 id="personal-licence-heading" className="text-lg font-semibold">Personal licence</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            A licence to sell alcohol. If a workplace sells alcohol, the rota warns you when nobody with one is on shift. Set this on{" "}
            <Link href="/workplaces" className="underline">Workplaces</Link>.
          </p>
          <PersonalLicenceForm workerId={worker.id} current={worker.personalLicence ?? null} />
        </section>
      )}

      {sector !== "care" && (
        <section id="sunday" className="mt-8 scroll-mt-4" aria-labelledby="sunday-heading">
          <h2 id="sunday-heading" className="text-lg font-semibold">Sunday working</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Shop and betting workers can opt out of working on Sundays by giving written notice. Once the notice runs out, they cannot be made to work
            Sundays or treated worse for refusing. Untick this if they opt back in. Based on: {SUNDAY_LEGAL_REF}.
          </p>
          <SundayOptOutForm
            workerId={worker.id}
            current={worker.sundayOptOut ?? null}
            from={worker.sundayOptOut ? sundayOptOutFrom(worker.sundayOptOut.noticeGivenOn, worker.sundayOptOut.statementGiven) : null}
          />
        </section>
      )}

      {(isSchoolAge(worker.dateOfBirth, today) || worker.childWorkPermit) && (
        <section id="child-permit" className="mt-8 scroll-mt-4" aria-labelledby="child-permit-heading">
          <h2 id="child-permit-heading" className="text-lg font-semibold">Work permit (school age)</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {worker.fullName} is of school age until {ukDate(schoolLeavingDate(worker.dateOfBirth))}. Until then they need a work permit from the council
            where they go to school, and can only do light work within set hours. The rota checks these limits. Based on: {CHILD_LEGAL_REF}.
          </p>
          <ChildPermitForm workerId={worker.id} current={worker.childWorkPermit ?? null} />
        </section>
      )}

      <section id="night-health" className="mt-8 scroll-mt-4" aria-labelledby="night-health-heading">
        <h2 id="night-health-heading" className="text-lg font-semibold">Night work health assessments</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Anyone who works at least 3 hours between 11pm and 6am must be offered a free health assessment before they start nights, and every year after.
          Only record the offer and whether they took it up, never the result. Based on: {NIGHT_HEALTH_LEGAL_REF}.
        </p>
        {nightHealth.length > 0 && (
          <ul className="mt-2 list-disc pl-6">
            {nightHealth.map((h) => (
              <li key={h.id}>
                Offered {ukDate(h.offeredOn)}: {h.outcome === "taken" ? "they had the assessment" : h.outcome === "declined" ? "they chose not to have it" : "waiting for an answer"}
              </li>
            ))}
          </ul>
        )}
        <NightHealthForm workerId={worker.id} today={today} />
      </section>

      <section id="agency" className="mt-8 scroll-mt-4" aria-labelledby="agency-heading">
        <h2 id="agency-heading" className="text-lg font-semibold">Agency worker</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          After 12 weeks in the same role, agency workers have the right to the same basic pay and conditions as your own staff. See{" "}
          <Link href="/agency" className="underline">Agency workers</Link>.
        </p>
        <AgencyForm workerId={worker.id} current={worker.agency ?? null} />
      </section>

      <section id="sponsorship" className="mt-8 scroll-mt-4" aria-labelledby="sponsorship-heading">
        <h2 id="sponsorship-heading" className="text-lg font-semibold">Visa sponsorship</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          If you sponsor {worker.fullName}, VicisRota watches for what you must report to the Home Office. See{" "}
          <Link href="/sponsorship" className="underline">Sponsored workers</Link>.
        </p>
        <SponsorshipForm workerId={worker.id} current={worker.sponsorship ?? null} />
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
                {c.updateService && ", on the Update Service"}
                {c.expiresOn && `, recheck due ${ukDate(c.expiresOn)}`}
                {c.expiresOn && c.expiresOn < today ? " (overdue)" : ""}
              </li>
            ))}
          </ul>
        )}
        <AddCheckForm workerId={worker.id} />
      </section>

      <section id="training" className="mt-10 scroll-mt-4">
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
                  {t.reference && <span className="text-muted"> · number {t.reference}</span>}
                  {t.courseUrl && (
                    <>
                      {" · "}
                      <a href={t.courseUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        Course
                      </a>
                    </>
                  )}
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
        <p className="mt-3 text-sm text-muted">
          Course links for each kind of training are set on the <Link href="/training" className="underline">Training page</Link>.
        </p>
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

      <section className="mt-10" id="payroll">
        <h2 className="text-lg font-semibold">Payroll</h2>
        <PayrollIdForm workerId={worker.id} payrollId={worker.payrollId} />
      </section>

      <section className="mt-10" id="supervision">
        <h2 className="text-lg font-semibold">Supervision and appraisal</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A record of when they happened and when the next is due, for inspections. Keep what was discussed in the person&apos;s private supervision notes.
        </p>
        {supervisions.length === 0 ? (
          <p className="mt-2">None recorded yet.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6">
            {supervisions.map((s) => (
              <li key={s.id}>
                {s.kind === "supervision" ? "Supervision" : "Appraisal"} on {ukDate(s.heldOn)}
                {s.nextDueOn && `, next due ${ukDate(s.nextDueOn)}`}
              </li>
            ))}
          </ul>
        )}
        <SupervisionForm workerId={worker.id} />
      </section>

      <section id="leaving" className="mt-8 scroll-mt-4" aria-labelledby="leaving-heading">
        <h2 id="leaving-heading" className="text-lg font-semibold">Leaving</h2>
        <p className="mt-1 text-muted">
          {worker.leftOn
            ? "If they come back, or were marked by mistake, put them back on the team."
            : `When ${worker.fullName} leaves, their records are kept for payroll and working-time checks. Shifts after their last day become open shifts.`}
        </p>
        <LeavingForm workerId={worker.id} name={worker.fullName} leftOn={worker.leftOn} today={today} />
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
