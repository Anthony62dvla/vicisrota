import { schema, withOrganisation } from "@vicisrota/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { jobPath, STATUS_LABEL, UUID } from "@/lib/hiring";
import { appUrl } from "@/lib/sms";
import { setPostOpen } from "../actions";
import { ApplicantForm, CopyLink, HireForm } from "../forms";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });
const CONTACT = { email: "email", phone: "a phone call", text: "a text message" } as Record<string, string>;
/** Statuses a manager can choose. Hired is set by taking the person on. */
const CHOOSABLE = Object.entries(STATUS_LABEL).filter(([k]) => k !== "hired") as [string, string][];

export default async function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organisationId } = await requireManager();
  if (!UUID.test(id)) notFound();
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const [post] = await tx.select().from(schema.jobPost).where(eq(schema.jobPost.id, id));
    if (!post) return null;
    const applicants = await tx.select().from(schema.applicant).where(eq(schema.applicant.jobPostId, id)).orderBy(asc(schema.applicant.createdAt));
    return { post, applicants };
  });
  if (!data) notFound();
  const { post, applicants } = data;
  const url = appUrl(jobPath(organisationId, post.id));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <Link href="/hiring" className="underline">All adverts</Link>
      <h1 className="mt-2 text-2xl font-semibold">{post.title}</h1>
      <p className="mt-1">{post.open ? "Open: people can apply." : "Closed: nobody new can apply."}</p>

      <section className="mt-6 rounded-lg border p-4" aria-labelledby="share-heading">
        <h2 id="share-heading" className="font-semibold">Share the advert</h2>
        {post.open ? (
          <>
            <p className="mt-1">Anyone with this link can read the advert and apply.</p>
            <CopyLink url={url} />
            <p className="mt-2">
              <a href={jobPath(organisationId, post.id)} target="_blank" className="underline">See it as applicants do</a>
            </p>
          </>
        ) : (
          <p className="mt-1">Open the advert again to share it.</p>
        )}
        <form action={setPostOpen} className="mt-3">
          <input type="hidden" name="id" value={post.id} />
          <input type="hidden" name="open" value={post.open ? "false" : "true"} />
          <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">{post.open ? "Close the advert" : "Open the advert again"}</button>
        </form>
      </section>

      <section className="mt-8" aria-labelledby="applicants-heading">
        <h2 id="applicants-heading" className="text-lg font-semibold">Applications ({applicants.length})</h2>
        {applicants.length === 0 && <p className="mt-2">None yet.</p>}
        <ul className="mt-3 flex flex-col gap-4">
          {applicants.map((a) => (
            <li key={a.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{a.name}</h3>
                <span className="rounded-full border px-2.5 py-0.5 text-sm">{STATUS_LABEL[a.status]}</span>
              </div>
              <p className="text-sm text-muted">Applied {when.format(a.createdAt)}</p>
              <p className="mt-2 flex flex-wrap gap-x-4">
                {a.email && <a href={`mailto:${a.email}`} className="underline">{a.email}</a>}
                {a.phone && <a href={`tel:${a.phone}`} className="underline">{a.phone}</a>}
              </p>
              {a.contactBy && <p className="text-sm">Prefers {CONTACT[a.contactBy] ?? a.contactBy}.</p>}
              <h4 className="mt-3 font-medium">About them</h4>
              <p className="whitespace-pre-wrap">{a.about}</p>
              {a.adjustments && (
                <div className="mt-3 rounded-lg border border-brand bg-brand-soft p-3">
                  <h4 className="font-medium">What would help them at an interview</h4>
                  <p className="whitespace-pre-wrap">{a.adjustments}</p>
                </div>
              )}
              {a.status === "hired" ? (
                <p className="mt-3">
                  Taken on.{" "}
                  {a.hiredWorkerId && <Link href={`/staff/${a.hiredWorkerId}`} className="underline">Open their staff record</Link>}
                </p>
              ) : (
                <>
                  <ApplicantForm id={a.id} status={a.status} notes={a.notes ?? ""} statuses={CHOOSABLE} />
                  <details className="mt-3">
                    <summary className="cursor-pointer font-medium">Take {a.name} on</summary>
                    <HireForm id={a.id} name={a.name} />
                  </details>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
