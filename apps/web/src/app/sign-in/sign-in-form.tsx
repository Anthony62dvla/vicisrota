"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/next-path";
import type { SsoProvider } from "@/lib/sso";
import { Field, FormShell, SubmitButton } from "../form";
import { SocialButtons } from "./social-buttons";

export function SignInForm({ providers, initialError }: { providers: SsoProvider[]; initialError: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError("That email and password do not match. Please check them and try again.");
    // After accepting an invitation link, return to it; otherwise the dashboard sends people to the right place.
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard";
    // People with two-step sign-in turned on enter a code from their app next.
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return router.push(`/sign-in/two-step?next=${encodeURIComponent(next)}`);
    router.push(next);
  }

  return (
    <FormShell title="Sign in" error={error} action={onSubmit}>
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <SocialButtons providers={providers} from="/sign-in" />
      <p>
        New to VicisRota? <Link href="/sign-up" className="underline">Create an account</Link>
      </p>
    </FormShell>
  );
}
