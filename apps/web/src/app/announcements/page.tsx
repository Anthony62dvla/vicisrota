import { schema, withOrganisation } from "@vicisrota/db";
import { asc, desc } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { archiveAnnouncement } from "./actions";
import { AnnouncementForm } from "./forms";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export default async function AnnouncementsPage() {
  const { organisationId, businessName } = await requireManager();
  const { posts, reads, staff } = await withOrganisation(db, organisationId, async (tx) => ({
    posts: await tx.select().from(schema.announcement).orderBy(desc(schema.announcement.createdAt)).limit(50),
    reads: await tx.select().from(schema.announcementRead),
    // Only people who can sign in can read announcements, so only they are counted.
    staff: (await tx.select({ id: schema.worker.id, name: schema.worker.fullName, userId: schema.worker.userId }).from(schema.worker).orderBy(asc(schema.worker.fullName))).filter((w) => w.userId),
  }));
  const current = posts.filter((p) => !p.archivedAt);
  const archived = posts.filter((p) => p.archivedAt);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <p>
        <Link href="/dashboard" className="underline">{businessName}</Link> · <Link href="/rota" className="underline">Rota</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Announcements</h1>
      <p className="mt-1">Messages for all staff. They appear at the top of each person&apos;s page until they have read them.</p>

      <section className="mt-8" aria-labelledby="new-heading">
        <h2 id="new-heading" className="text-lg font-semibold">New announcement</h2>
        <AnnouncementForm />
      </section>

      <section className="mt-10" aria-labelledby="current-heading">
        <h2 id="current-heading" className="text-lg font-semibold">Showing to staff</h2>
        {current.length === 0 && <p className="mt-2">Nothing at the moment.</p>}
        <ul className="mt-3 flex flex-col gap-4">
          {current.map((p) => {
            const readBy = new Set(reads.filter((r) => r.announcementId === p.id).map((r) => r.workerId));
            const notYet = staff.filter((w) => !readBy.has(w.id));
            return (
              <li key={p.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Posted {when.format(p.createdAt)}</p>
                <p className="mt-2 whitespace-pre-line">{p.body}</p>
                <p className="mt-3 font-medium">
                  {p.needsConfirmation ? "Confirmed" : "Read"} by {staff.length - notYet.length} of {staff.length} staff with a login
                </p>
                {notYet.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer">Not yet ({notYet.length})</summary>
                    <ul className="mt-1 list-disc pl-6">
                      {notYet.map((w) => <li key={w.id}>{w.name}</li>)}
                    </ul>
                  </details>
                )}
                <form action={archiveAnnouncement} className="mt-3">
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1">Stop showing this</button>
                </form>
              </li>
            );
          })}
        </ul>
      </section>

      {archived.length > 0 && (
        <section className="mt-10" aria-labelledby="old-heading">
          <h2 id="old-heading" className="text-lg font-semibold">No longer showing</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Kept with who read them, as a record.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {archived.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.title}</span> · posted {when.format(p.createdAt)} · read by{" "}
                {reads.filter((r) => r.announcementId === p.id).length}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
