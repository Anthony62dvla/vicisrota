"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Field, FormShell, SubmitButton } from "../form";

export default function SignIn() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError("That email and password do not match. Please check them and try again.");
    router.push("/dashboard");
  }

  return (
    <FormShell title="Sign in" error={error} action={onSubmit}>
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <p>
        New to VicisRota? <Link href="/sign-up" className="underline">Create an account</Link>
      </p>
    </FormShell>
  );
}
