"use client";

import { useActionState } from "react";
import { recordOffer, saveContractedHours, type FormState } from "./actions";

const input = "w-24 rounded-lg border border-zinc-400 px-3 py-2 text-base";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function ContractedHoursForm({ workerId, name, hours }: { workerId: string; name: string; hours: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveContractedHours, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Contract hours a week for {name}</span>
          <input name="contractedHours" inputMode="decimal" defaultValue={hours ?? ""} placeholder="0" className={input} />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg border border-zinc-400 px-3 py-2">
          Save
        </button>
      </div>
    </form>
  );
}

export function OfferForm({ workerId, suggested }: { workerId: string; suggested: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordOffer, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Hours offered a week</span>
          <input name="weeklyHours" inputMode="decimal" defaultValue={suggested} className={input} />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-3 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
          Record offer
        </button>
      </div>
    </form>
  );
}
