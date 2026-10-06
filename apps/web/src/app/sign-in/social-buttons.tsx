"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/next-path";
import type { SsoProvider } from "@/lib/sso";

/**
 * "Continue with Microsoft / Google" buttons, under the email form. Shown only for providers that are switched on.
 * Only the sign-up page can make a new account this way, and only once the terms box is ticked.
 */
export function SocialButtons({ providers, from, termsAccepted }: { providers: SsoProvider[]; from: "/sign-in" | "/sign-up"; termsAccepted?: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [needsTick, setNeedsTick] = useState(false);
  if (!providers.length) return null;
  const signingUp = from === "/sign-up";

  async function go(provider: SsoProvider["id"]) {
    if (signingUp && !termsAccepted) return setNeedsTick(true);
    setNeedsTick(false);
    setPending(provider);
    setFailed(false);
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard";
    const back = `${from}?next=${encodeURIComponent(next)}`;
    const { error } = await authClient.signIn.social({ provider, callbackURL: next, newUserCallbackURL: next, errorCallbackURL: back, requestSignUp: signingUp });
    if (error) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </p>
      {needsTick && !termsAccepted && (
        <p role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 dark:bg-amber-950">
          Please tick the box to accept the terms of service first.
        </p>
      )}
      {failed && (
        <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-3 dark:bg-red-950">
          That did not work. Please try again, or sign in with your email and password.
        </p>
      )}
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => go(p.id)}
          disabled={pending !== null}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 font-medium hover:bg-brand-soft disabled:opacity-60"
        >
          {pending === p.id ? `Opening ${p.label}…` : `Continue with ${p.label}`}
        </button>
      ))}
    </div>
  );
}
