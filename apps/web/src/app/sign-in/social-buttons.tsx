"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeNextPath } from "@/lib/next-path";
import type { SsoProvider } from "@/lib/sso";

/** "Continue with Microsoft / Google" buttons, under the email form. Shown only for providers that are switched on. */
export function SocialButtons({ providers, from }: { providers: SsoProvider[]; from: "/sign-in" | "/sign-up" }) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (!providers.length) return null;

  async function go(provider: SsoProvider["id"]) {
    setPending(provider);
    setFailed(false);
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/dashboard";
    const back = `${from}?next=${encodeURIComponent(next)}`;
    const { error } = await authClient.signIn.social({ provider, callbackURL: next, newUserCallbackURL: next, errorCallbackURL: back });
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
