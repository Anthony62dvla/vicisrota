"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { SsoProvider } from "@/lib/sso";

/** Link or unlink a Microsoft or Google account, so the person can sign in with it as well as their password. */
export function LinkedAccounts({ providers, linked }: { providers: SsoProvider[]; linked: Record<string, string> }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function link(provider: SsoProvider["id"]) {
    setPending(provider);
    setMessage(null);
    const { error } = await authClient.linkSocial({ provider, callbackURL: "/security?linked=1", errorCallbackURL: "/security?linked=0" });
    if (error) {
      setPending(null);
      setMessage("That did not work. Please try again.");
    }
  }

  async function unlink(provider: SsoProvider) {
    setPending(provider.id);
    setMessage(null);
    const { error } = await authClient.unlinkAccount({ accountId: linked[provider.id]! });
    setPending(null);
    if (error) return setMessage("That did not work. Please try again.");
    setMessage(`Your ${provider.label} account is no longer linked.`);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {message && (
        <p role="status" className="rounded-lg border border-line bg-brand-soft p-3">
          {message}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {providers.map((p) => {
          const on = p.id in linked;
          return (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
              <span>
                <span className="font-medium">{p.label}</span>: {on ? "linked" : "not linked"}
              </span>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => (on ? unlink(p) : link(p.id))}
                className={
                  on
                    ? "rounded-lg border border-line px-4 py-2 font-medium hover:bg-brand-soft disabled:opacity-60"
                    : "rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-hover disabled:opacity-60"
                }
              >
                {pending === p.id ? "Please wait…" : on ? `Unlink ${p.label}` : `Link ${p.label}`}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
