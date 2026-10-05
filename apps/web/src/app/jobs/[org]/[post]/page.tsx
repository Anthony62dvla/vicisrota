import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { KEEP_APPLICATIONS_DAYS, UUID } from "@/lib/hiring";
import { Logo } from "../../../icons";
import { ApplyForm } from "./form";

type Params = { params: Promise<{ org: string; post: string }> };

const load = async (org: string, post: string) => {
  if (!UUID.test(org) || !UUID.test(post)) return null;
  return withOrganisation(db, org, async (tx) => {
    const [row] = await tx
      .select({ post: schema.jobPost, business: schema.organisation.name })
      .from(schema.jobPost)
      .innerJoin(schema.organisation, eq(schema.jobPost.organisationId, schema.organisation.id))
      .where(and(eq(schema.jobPost.id, post), eq(schema.jobPost.open, true)));
    return row ?? null;
  });
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { org, post } = await params;
  const row = await load(org, post);
  return { title: row ? `${row.post.title} at ${row.business}` : "Job not found" };
}

/** The public page for a job advert. Anyone can read it and apply, without an account. */
export default async function JobPage({ params }: Params) {
  const { org, post } = await params;
  const row = await load(org, post);
  if (!row) notFound();
  const { post: job, business } = row;
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <p className="text-muted">{business} is hiring</p>
      <h1 className="mt-1 text-3xl font-semibold">{job.title}</h1>
      <dl className="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        {job.place && (
          <>
            <dt className="font-medium">Where</dt>
            <dd>{job.place}</dd>
          </>
        )}
        {job.hours && (
          <>
            <dt className="font-medium">Hours</dt>
            <dd>{job.hours}</dd>
          </>
        )}
        {job.pay && (
          <>
            <dt className="font-medium">Pay</dt>
            <dd>{job.pay}</dd>
          </>
        )}
      </dl>
      <div className="mt-6 whitespace-pre-wrap">{job.description}</div>

      <section className="mt-10 rounded-xl border p-5" aria-labelledby="apply-heading">
        <h2 id="apply-heading" className="text-xl font-semibold">Apply</h2>
        <ApplyForm organisationId={org} postId={post} businessName={business} keepDays={KEEP_APPLICATIONS_DAYS} />
      </section>

      <p className="mt-8 flex items-center gap-2 text-sm text-muted">
        <Logo className="h-5 w-5" /> Sent securely through VicisRota.
      </p>
    </main>
  );
}
