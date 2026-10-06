import { withOrganisation } from "@vicisrota/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { statementPersonFor } from "@/lib/statements";
import { GiveForm } from "../../forms";

const UUID = /^[0-9a-f-]{36}$/i;

/** Check and complete one person's details, then give them their statement. */
export default async function GiveStatementPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await params;
  if (!UUID.test(workerId)) notFound();
  const { organisationId } = await requireManager();
  const person = await withOrganisation(db, organisationId, (tx) => statementPersonFor(tx, organisationId, workerId));
  if (!person) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/statements" className="underline">
          Written statements
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Written statement for {person.workerName}</h1>
      <p className="mt-2">
        Check these details. Pay, holiday and your business&apos;s terms are added for you. Once given, the statement is saved exactly as it is, and{" "}
        {person.workerName} is told it is ready to read.
      </p>
      {person.hourlyPence == null && (
        <p className="mt-3 rounded-lg border-2 border-amber-500 p-3">
          There is no pay rate for {person.workerName} yet. Add one on their{" "}
          <Link href={`/staff/${workerId}`} className="underline">
            staff record
          </Link>{" "}
          first.
        </p>
      )}
      <GiveForm workerId={workerId} values={{ jobTitle: person.jobTitle, startDate: person.startDate ?? "", hours: person.hours, placeOfWork: person.placeOfWork }} />
    </main>
  );
}
