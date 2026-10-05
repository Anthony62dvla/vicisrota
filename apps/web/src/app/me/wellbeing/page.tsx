import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { localeOf } from "@vicisrota/messaging";
import { messagesFor } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { ANSWERS, NOTE_MAX, pendingCheckIns } from "@/lib/wellbeing";
import { deleteCheckIn } from "./actions";
import { CheckInForm, WellbeingSettingsForm } from "./forms";


/** The person's own wellbeing check-ins: whether to be asked, any waiting, and what they said before. */
export default async function MyWellbeingPage() {
  const { organisationId, worker } = await requireStaff();
  const choice = worker.preferences.wellbeing ?? {};
  const lang = await getLang();
  const locale = localeOf(lang);
  const { wellbeing: t, wellbeingForm } = messagesFor(lang);
  const shiftFmt = new Intl.DateTimeFormat(locale, { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayFmt = new Intl.DateTimeFormat(locale, { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
  const answers = ANSWERS.map((a, i) => ({ value: a.value, label: t.answers[i]! }));
  const answerLabel = (v: number | null) => answers.find((a) => a.value === v)?.label ?? t.skippedLabel;
  const now = new Date().getTime();
  const { pending, history } = await withOrganisation(db, organisationId, async (tx) => ({
    pending: await pendingCheckIns(tx, worker.id, now),
    history: await tx
      .select({ checkIn: schema.wellbeingCheckIn, startsAt: schema.shift.startsAt })
      .from(schema.wellbeingCheckIn)
      .leftJoin(schema.shift, eq(schema.wellbeingCheckIn.shiftId, schema.shift.id))
      .where(eq(schema.wellbeingCheckIn.workerId, worker.id))
      .orderBy(desc(schema.wellbeingCheckIn.createdAt))
      .limit(30),
  }));
  const answered = history.filter((h) => h.checkIn.answer !== null);
  // Shown after answering, from the server, so it stays on screen once the question has gone.
  const justDone = history.filter((h) => now - h.checkIn.createdAt.getTime() < 30 * 60_000);

  return (
    <main lang={locale} className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/me" className="underline">{t.myShifts}</Link>
      <h1 className="mt-2 text-2xl font-semibold">{t.title}</h1>
      <p className="mt-1">{t.intro}</p>

      {justDone.map(({ checkIn }) => (
        <section key={checkIn.id} role="status" className="mt-6 rounded-lg border border-green-600 p-4">
          <p className="font-medium">
            {checkIn.answer === null ? t.skipped : checkIn.answer === 5 ? t.reallyHard : t.thanks}
          </p>
          {checkIn.wantsChat && (
            <p className="mt-1">{t.chatAsked}{checkIn.shared ? "" : ` ${t.staysPrivate}`}</p>
          )}
          {(checkIn.answer ?? 0) >= 4 && (
            <p className="mt-2">
              {t.samaritans}{" "}
              <a href="tel:116123" className="font-semibold underline">116 123</a>.
            </p>
          )}
        </section>
      ))}

      {pending.map((s) => (
        <section key={s.id} className="mt-6 rounded-lg border-2 border-brand p-4" aria-label={t.howWasIt}>
          <h2 className="text-lg font-semibold">{t.howWasIt}</h2>
          <p className="text-muted">{shiftFmt.format(s.startsAt)} {t.to} {timeFmt.format(s.endsAt)}</p>
          <CheckInForm shiftId={s.id} answers={answers} noteMax={NOTE_MAX} t={wellbeingForm} />
        </section>
      ))}

      <section className="mt-8" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-lg font-semibold">{t.choices}</h2>
        <WellbeingSettingsForm on={!!choice.on} after={choice.after ?? "hard"} share={!!choice.share} t={wellbeingForm} />
      </section>

      {history.length > 0 && (
        <section className="mt-10" aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-lg font-semibold">{t.before}</h2>
          {answered.length > 0 && (
            <p className="mt-1">
              {answered.length === 1
                ? t.lastOne(answerLabel(answered[0]!.checkIn.answer))
                : t.lastMany(
                    answered.length,
                    answers
                      .map((a) => ({ ...a, n: answered.filter((h) => h.checkIn.answer === a.value).length }))
                      .filter((a) => a.n > 0)
                      .map((a) => `${a.label} ${a.n}`)
                      .join(", "),
                  )}
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {history.map(({ checkIn, startsAt }) => (
              <li key={checkIn.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">
                    {answerLabel(checkIn.answer)}
                    <span className="font-normal text-muted"> · {startsAt ? t.shiftOn(dayFmt.format(startsAt)) : dayFmt.format(checkIn.createdAt)}</span>
                  </p>
                  {checkIn.note && <p className="whitespace-pre-wrap">{checkIn.note}</p>}
                  <p className="text-sm text-muted">
                    {checkIn.shared ? t.shared : t.private}
                    {checkIn.wantsChat ? ` · ${checkIn.chatHandledAt ? t.chatHad : t.chatAskedShort}` : ""}
                  </p>
                </div>
                <form action={deleteCheckIn}>
                  <input type="hidden" name="id" value={checkIn.id} />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">{t.delete}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
