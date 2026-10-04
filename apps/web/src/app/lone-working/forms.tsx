"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useSyncExternalStore } from "react";
import { addAlertContact, markDealtWith, type FormState } from "./actions";

/**
 * Keeps the page current while it is left open, so a missed check-in shows without reloading. With the
 * "No movement" display setting the page stays still and offers a button instead.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  // The setting only changes on a full page load, so there is nothing to subscribe to.
  const still = useSyncExternalStore(
    () => () => {},
    () => document.documentElement.hasAttribute("data-still"),
    () => false,
  );
  useEffect(() => {
    if (still) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, still]);
  if (!still) return null;
  return (
    <button type="button" onClick={() => router.refresh()} className="mb-4 rounded-lg border border-zinc-400 px-4 py-2">
      Refresh this page
    </button>
  );
}

export function DealtWithForm({ shiftId }: { shiftId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(markDealtWith, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <input type="hidden" name="shiftId" value={shiftId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">What did you do?</span>
        <input name="note" required maxLength={2000} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-3 py-1 disabled:opacity-60">Mark as dealt with</button>
    </form>
  );
}

export function AddAlertContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addAlertContact, {});
  const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name</span>
        <input name="name" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">UK mobile number</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="off" required className={input} />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>They have agreed to receive alert texts, including at night</span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">Add</button>
    </form>
  );
}
