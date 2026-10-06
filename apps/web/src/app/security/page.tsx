import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ssoProviders } from "@/lib/sso";
import { isSuperadmin } from "@/lib/superadmin";
import { LinkedAccounts } from "./linked-accounts";
import { TwoStepSettings } from "./two-step-settings";

/** Sign-in security for anyone with a login: managers, staff and the superadmin. */
export default async function SecurityPage({ searchParams }: PageProps<"/security">) {
  const user = await requireUser();
  const { linked } = await searchParams;
  const providers = ssoProviders();
  const accounts = providers.length
    ? Object.fromEntries(
        (await db.select({ id: schema.account.id, providerId: schema.account.providerId }).from(schema.account).where(eq(schema.account.userId, user.id))).map((a) => [
          a.providerId,
          a.id,
        ]),
      )
    : {};
  const passwordOnly = !!user.twoFactorEnabled || (await isSuperadmin(user.id));
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
      {providers.length > 0 && (
        <section className="mt-10" aria-labelledby="linked-heading">
          <h2 id="linked-heading" className="text-lg font-semibold">Microsoft and Google</h2>
          {linked === "1" && (
            <p role="status" className="mt-3 rounded-lg border border-line bg-brand-soft p-3">
              Linked. You can now sign in with that account as well as your password.
            </p>
          )}
          {linked === "0" && (
            <p role="alert" className="mt-3 rounded-lg border border-red-400 bg-red-50 p-3 dark:bg-red-950">
              That account could not be linked. It needs to use the same email address as your VicisRota login.
            </p>
          )}
          {passwordOnly ? (
            <p className="mt-1">
              {user.twoFactorEnabled
                ? "You have two-step sign-in turned on, so you sign in with your password and code. Signing in with Microsoft or Google would skip that check."
                : "The superadmin account signs in with email and password only."}
            </p>
          ) : (
            <>
              <p className="mt-1">
                Link your work or personal account to sign in with one button instead of typing your password. It must use the same email address as your VicisRota
                login. Your password keeps working too.
              </p>
              <LinkedAccounts providers={providers} linked={accounts} />
            </>
          )}
        </section>
      )}
      <p className="mt-8">
        <Link href="/dashboard" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
