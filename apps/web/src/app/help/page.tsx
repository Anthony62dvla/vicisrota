import { schema } from "@vicisrota/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { firstMembership } from "@/lib/business";
import { db } from "@/lib/db";
import { safeNextPath } from "@/lib/next-path";
import { SUPPORT_MAX } from "@/lib/support";
import { reportProblem } from "./actions";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const STATUS = { new: "Waiting to be read", triaged: "Being looked at", replied: "Answered", closed: "Closed" } as const;

export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const user = await requireUser();
  const membership = await firstMembership(user.id);
  const params = await searchParams;
  const from = safeNextPath(String(params.from ?? "")) ?? "";
  const ref = String(params.ref ?? "").slice(0, 40);
  const sent = params.sent === "1";
  const error = params.error === "empty" ? "Please write what happened." : params.error === "long" ? `Please keep it under ${SUPPORT_MAX} characters.` : null;

  const mine = await db
    .select()
    .from(schema.supportReport)
    .where(eq(schema.supportReport.reporterUserId, user.id))
    .orderBy(desc(schema.supportReport.createdAt))
    .limit(20);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Report a problem</h1>
      <p className="mt-2">
        Tell the VicisRota team about something that is not working, or that is confusing. There is no wrong way to describe it. We read every report
        and reply here.
      </p>

      <aside className="mt-4 rounded-lg border-l-4 border-warn bg-warn-soft p-4">
        <p className="font-medium">This is not for safeguarding concerns</p>
        <p className="mt-1 text-sm">
          If you are worried about someone&apos;s safety, follow your organisation&apos;s safeguarding procedure
          {membership?.role === "worker" && (
            <>
              {" "}
              or use{" "}
              <Link href="/me/concern" className="underline">
                Raise a concern
              </Link>
            </>
          )}
          . If someone is in immediate danger, call 999.
        </p>
      </aside>

      {sent && (
        <p role="status" className="mt-6 rounded-lg border border-ok bg-ok-soft p-4">
          Thank you. Your report has been sent. You will see our reply under &ldquo;Your reports&rdquo; below.
        </p>
      )}

      <form action={reportProblem} className="mt-6 flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        {error && (
          <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-3 dark:bg-red-950">
            {error}
          </p>
        )}
        <input type="hidden" name="from" value={from} />
        <label className="flex flex-col gap-1">
          <span className="font-medium">What happened?</span>
          <span className="text-sm text-muted">
            What were you trying to do, and what did you see? Please leave out people&apos;s names and any health details.
          </span>
          <textarea name="what" required maxLength={SUPPORT_MAX} rows={6} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Error reference (optional)</span>
          <span className="text-sm text-muted">If an error page showed a reference, it helps us find exactly what went wrong.</span>
          <input name="ref" defaultValue={ref} className="rounded-lg border border-zinc-400 px-3 py-2 font-mono text-base" />
        </label>
        <button type="submit" className="self-start rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-hover">
          Send report
        </button>
      </form>

      {mine.length > 0 && (
        <section className="mt-10" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-lg font-semibold">
            Your reports
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {mine.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <p className="text-sm text-muted">
                  {dateFmt.format(r.createdAt)} · <strong>{STATUS[r.status]}</strong>
                </p>
                <p className="mt-1 whitespace-pre-line">{r.what}</p>
                {r.reply && (
                  <div className="mt-3 rounded-lg bg-brand-soft p-3">
                    <p className="text-sm font-semibold text-heading">Reply from the VicisRota team</p>
                    <p className="mt-1 whitespace-pre-line">{r.reply}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
