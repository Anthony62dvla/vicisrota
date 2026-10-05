import { schema, withOrganisation } from "@vicisrota/db";
import { asc, count, desc } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { KEEP_APPLICATIONS_DAYS } from "@/lib/hiring";
import { JobPostForm } from "./forms";

export default async function HiringPage() {
  const { organisationId } = await requireManager();
  const { posts, roles } = await withOrganisation(db, organisationId, async (tx) => {
    const posts = await tx.select().from(schema.jobPost).orderBy(desc(schema.jobPost.open), desc(schema.jobPost.createdAt));
    const counts = await tx
      .select({ postId: schema.applicant.jobPostId, status: schema.applicant.status, n: count() })
      .from(schema.applicant)
      .groupBy(schema.applicant.jobPostId, schema.applicant.status);
    const roles = await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole).orderBy(asc(schema.jobRole.name));
    return {
      posts: posts.map((p) => {
        const mine = counts.filter((c) => c.postId === p.id);
        return { ...p, total: mine.reduce((n, c) => n + Number(c.n), 0), fresh: Number(mine.find((c) => c.status === "new")?.n ?? 0) };
      }),
      roles,
    };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Hiring</h1>
      <p className="mt-1">
        Write a simple job advert and share its link anywhere: your website, social media, a job board or a poster. People apply on their
        phone without a CV or an account. When you take someone on, they go straight into your staff with their checks to do.
      </p>
      <p className="mt-2 text-sm text-muted">Applications are deleted after {Math.round(KEEP_APPLICATIONS_DAYS / 30)} months, unless you took the person on.</p>

      <section className="mt-8" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="text-lg font-semibold">Your adverts</h2>
        {posts.length === 0 && <p className="mt-2">None yet. Write your first one below.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/hiring/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-brand-soft">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.title}</span>
                  <span className="block text-sm text-muted">
                    {p.open ? "Open" : "Closed"} · {p.total} {p.total === 1 ? "application" : "applications"}
                  </span>
                </span>
                {p.fresh > 0 && <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-sm font-semibold text-on-brand">{p.fresh} new</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-lg font-semibold">Write a new advert</h2>
        <JobPostForm roles={roles} />
      </section>
    </main>
  );
}
