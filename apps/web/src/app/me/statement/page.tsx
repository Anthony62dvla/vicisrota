import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { StatementView } from "../../statements/statement-view";
import { markStatementRead } from "./actions";

/** The person's own written statement, the latest one given to them. */
export default async function MyStatementPage() {
  const { organisationId, worker } = await requireStaff();
  const [statement] = await withOrganisation(db, organisationId, (tx) =>
    tx.select().from(schema.writtenStatement).where(eq(schema.writtenStatement.workerId, worker.id)).orderBy(desc(schema.writtenStatement.issuedAt)).limit(1),
  );
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p className="print:hidden">
        <Link href="/me" className="underline">
          Back to your page
        </Link>
      </p>
      {!statement ? (
        <p className="mt-4">You have not been given a written statement in VicisRota yet. If you think you should have one, ask your manager.</p>
      ) : (
        <>
          <p className="mt-4 print:hidden">
            This sets out the main terms of your job. Take your time. If anything is wrong or unclear, ask your manager. Saying you have read it does
            not mean you agree with all of it.
          </p>
          <StatementView sections={statement.sections} issuedAt={statement.issuedAt} readAt={statement.readAt} />
          {!statement.readAt && (
            <form action={markStatementRead} className="mt-6 print:hidden">
              <input type="hidden" name="id" value={statement.id} />
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">
                I have read this
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
