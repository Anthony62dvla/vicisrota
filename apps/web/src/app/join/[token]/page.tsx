import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findOpenInvitation } from "./invite";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const open = await findOpenInvitation(token);
  if (!open) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">This link no longer works</h1>
        <p className="mt-4">It may have expired, been used already, or been replaced by a newer link. Ask your manager to send you a new one.</p>
      </main>
    );
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const [worker] = await withOrganisation(db, open.invitation.organisationId, (tx) =>
    tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, open.invitation.workerId)),
  );
  const next = encodeURIComponent(`/join/${token}`);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Join {open.businessName} on VicisRota</h1>
      <p className="mt-4">
        {worker ? `${open.businessName} has invited ${worker.name}` : `${open.businessName} has invited you`} to see their shifts and ask for
        time off here. You will only see your own information.
      </p>
      {session ? (
        <>
          <p className="mt-4">You are logged in as {session.user.email}.</p>
          <JoinForm token={token} businessName={open.businessName} />
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/sign-up?next=${next}`} className="rounded-lg bg-zinc-900 px-4 py-2 text-center text-white dark:bg-zinc-100 dark:text-zinc-900">
            Create your login
          </Link>
          <Link href={`/sign-in?next=${next}`} className="rounded-lg border border-zinc-400 px-4 py-2 text-center">
            I already have a login
          </Link>
        </div>
      )}
    </main>
  );
}
