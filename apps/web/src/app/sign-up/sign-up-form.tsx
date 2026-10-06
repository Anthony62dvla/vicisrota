"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/next-path";
import type { SsoProvider } from "@/lib/sso";
import { Field, FormShell, SubmitButton } from "../form";
import { SocialButtons } from "../sign-in/social-buttons";

export function SignUpForm({ providers, initialError }: { providers: SsoProvider[]; initialError: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      // Checked again on the server, which records when the terms were accepted.
      acceptTerms: form.get("acceptTerms") === "yes",
    } as Parameters<typeof authClient.signUp.email>[0]);
    setPending(false);
    if (error) return setError(error.message ?? "We could not create your account. Please try again.");
    // After accepting an invitation link, return to it; otherwise the dashboard sends people to the right place.
    router.push(safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard");
  }

  return (
    <FormShell title="Create your account" error={error} action={onSubmit}>
      <Field label="Your name" name="name" autoComplete="name" />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password (at least 10 characters)" name="password" type="password" autoComplete="new-password" minLength={10} />
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="acceptTerms"
          value="yes"
          required
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          I accept the <Link href="/terms" className="underline" target="_blank">terms of service</Link>.
        </span>
      </label>
      <p className="text-sm text-muted">
        Our <Link href="/privacy" className="underline" target="_blank">privacy policy</Link> explains how we look after your information.
      </p>
      <SubmitButton pending={pending}>Create account</SubmitButton>
      <SocialButtons providers={providers} from="/sign-up" termsAccepted={accepted} />
      <p>
        Already have an account? <Link href="/sign-in" className="underline">Sign in</Link>
      </p>
    </FormShell>
  );
}
