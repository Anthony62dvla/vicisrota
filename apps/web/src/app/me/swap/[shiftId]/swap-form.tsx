"use client";

import { useActionState } from "react";
import { askToSwap, type SwapState } from "../actions";

export function SwapForm({ myShiftId, options }: { myShiftId: string; options: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<SwapState, FormData>(askToSwap, {});
  if (state.ok) return <p role="status" className="mt-6 rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <input type="hidden" name="myShiftId" value={myShiftId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Their shift you would take</legend>
        {options.map((o) => (
          <label key={o.id} className="flex items-start gap-2">
            <input type="radio" name="theirShiftId" value={o.id} required className="mt-1" />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">A note for them (optional)</span>
        <textarea name="note" maxLength={300} rows={2} className="rounded-lg border border-zinc-400 px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Checking…" : "Ask to swap"}
      </button>
    </form>
  );
}
