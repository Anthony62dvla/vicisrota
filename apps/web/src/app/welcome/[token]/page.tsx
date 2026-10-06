import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { findOpenOwnerInvitation } from "@/lib/owner-invite";
import { WelcomeForm } from "./welcome-form";

export default async function WelcomePage({ params }: PageProps<"/welcome/[token]">) {
  const { token } = await params;
  const open = await findOpenOwnerInvitation(token);
  if (!open) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">This link no longer works</h1>
        <p className="mt-4">It may have expired, been used already, or been replaced by a newer link. Ask VicisRota to send you a new one.</p>
      </main>
    );
  }
  const session = await auth.api.getSession({ headers: await headers() });
  const next = encodeURIComponent(`/welcome/${token}`);
  const { ownerName, email } = open.invitation;
  const otherEmail = session && session.user.email.toLowerCase() !== email.toLowerCase();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Welcome to VicisRota, {ownerName}</h1>
      <p className="mt-4">
        <strong>{open.businessName}</strong> is ready for you to take over. Once you do, a short checklist will walk you through adding your
        staff and planning your first rota.
      </p>
      {session ? (
        <>
          <p className="mt-4">You are logged in as {session.user.email}.</p>
          {otherEmail && (
            <p className="mt-2 rounded-lg border border-amber-600 p-3">
              This link was sent to {email}. If that is not you, please do not continue, and let VicisRota know.
            </p>
          )}
          <WelcomeForm token={token} businessName={open.businessName} />
        </>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          <Link href={`/sign-up?next=${next}`} className="rounded-lg bg-brand px-4 py-2 text-center text-on-brand hover:bg-brand-hover">
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
