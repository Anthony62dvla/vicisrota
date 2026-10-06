import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { StatementView } from "../statement-view";

const UUID = /^[0-9a-f-]{36}$/i;

/** One statement exactly as it was given, ready to print. */
export default async function StatementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ given?: string }> }) {
  const { id } = await params;
  const { given } = await searchParams;
  if (!UUID.test(id)) notFound();
  const { organisationId } = await requireManager();
  const row = await withOrganisation(db, organisationId, async (tx) => {
    const [s] = await tx.select().from(schema.writtenStatement).where(eq(schema.writtenStatement.id, id));
    if (!s) return null;
    const [w] = await tx.select({ fullName: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, s.workerId));
    return { ...s, workerName: w?.fullName ?? "" };
  });
  if (!row) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p className="print:hidden">
        <Link href="/statements" className="underline">
          Written statements
        </Link>
      </p>
      {given && (
        <p role="status" className="mt-3 rounded-lg border border-green-600 p-3 print:hidden">
          Statement given. {row.workerName} has been told it is ready to read.
        </p>
      )}
      <StatementView sections={row.sections} issuedAt={row.issuedAt} readAt={row.readAt} />
    </main>
  );
}
