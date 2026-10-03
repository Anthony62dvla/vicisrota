"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { markDealtWith, type FormState } from "./actions";

/** Keeps the page current while it is left open, so a missed check-in shows without reloading. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
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
