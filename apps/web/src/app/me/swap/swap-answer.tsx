"use client";

import { useActionState } from "react";
import { answerSwap, type SwapState } from "./actions";

/** Yes or no to a colleague's swap request. Saying no is always fine. */
export function SwapAnswer({ swapId }: { swapId: string }) {
  const [state, action, pending] = useActionState<SwapState, FormData>(answerSwap, {});
  if (state.ok) return <p role="status" className="mt-2 text-sm">{state.ok}</p>;
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-2 text-sm">{state.error}</p>}
      <input type="hidden" name="swapId" value={swapId} />
      <p className="text-sm">It is fine to say no.</p>
      <div className="flex gap-2">
        <button type="submit" name="answer" value="yes" disabled={pending} className="rounded-lg bg-brand px-3 py-1 text-on-brand disabled:opacity-60">Yes, swap</button>
        <button type="submit" name="answer" value="no" disabled={pending} className="rounded-lg border border-zinc-400 px-3 py-1 disabled:opacity-60">No, thanks</button>
      </div>
    </form>
  );
}
