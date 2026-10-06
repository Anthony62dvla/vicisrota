"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/next-path";
import { Field, FormShell, SubmitButton } from "../../form";

/** The second step of signing in: a code from the person's authenticator app, or one of their backup codes. */
export default function TwoStep() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [backup, setBackup] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setError(null);
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const trustDevice = form.get("trust") === "on";
    const { error } = backup ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice }) : await authClient.twoFactor.verifyTotp({ code, trustDevice });
    setPending(false);
    if (error)
      return setError(
        backup
          ? "That backup code did not work. Each code can only be used once. Check it and try again."
          : "That code did not work. Codes change every 30 seconds, so use the one showing now. If it keeps failing, use a backup code.",
      );
    router.push(safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard");
  }

  return (
    <FormShell title="Enter your code" error={error} action={onSubmit}>
      <p>{backup ? "Type one of the backup codes you saved when you set up two-step sign-in." : "Open your authenticator app and type the 6-digit code for VicisRota."}</p>
      {backup ? (
        <Field key="backup" label="Backup code" name="code" autoComplete="off" autoCapitalize="none" spellCheck={false} />
      ) : (
        <Field key="totp" label="6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus />
      )}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="trust" className="mt-1 h-5 w-5" />
        <span>Don&apos;t ask again on this device for 30 days. Only tick this on your own phone or computer.</span>
      </label>
      <SubmitButton pending={pending}>Continue</SubmitButton>
      <button type="button" onClick={() => (setBackup(!backup), setError(null))} className="self-start underline">
        {backup ? "Use a code from my app instead" : "I can't use my app: use a backup code"}
      </button>
    </FormShell>
  );
}
