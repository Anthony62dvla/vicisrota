import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { TwoStepSettings } from "./two-step-settings";

/** Sign-in security for anyone with a login: managers, staff and the superadmin. */
export default async function SecurityPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Sign-in security</h1>
      <section className="mt-6" aria-labelledby="two-step-heading">
        <h2 id="two-step-heading" className="text-lg font-semibold">Two-step sign-in</h2>
        <p className="mt-1">
          With two-step sign-in, signing in needs your password and a 6-digit code from an authenticator app on your phone, such as Google Authenticator,
          Microsoft Authenticator or 1Password. Someone who learns your password still cannot get in. Managers can see staff records, so we strongly recommend it
          for them.
        </p>
        <TwoStepSettings enabled={!!user.twoFactorEnabled} />
      </section>
      <p className="mt-8">
        <Link href="/dashboard" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
