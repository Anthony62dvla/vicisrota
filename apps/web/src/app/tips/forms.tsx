"use client";

import { useActionState } from "react";
import { recordTip, saveTippingPolicy, shareTips, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function RecordTipForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordTip, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date received</span>
        <input name="receivedOn" type="date" required defaultValue={today} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Amount (£)</span>
        <input name="amount" inputMode="decimal" required placeholder="86.40" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">How it was paid</span>
        <select name="source" defaultValue="card" className={input}>
          <option value="card">Card tips</option>
          <option value="cash">Cash given to the business</option>
          <option value="service_charge">Service charge</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Note (optional)</span>
        <input name="note" placeholder="Saturday card tips" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Record tips"}</button>
    </form>
  );
}

export function ShareTipsForm({ from, to, label }: { from: string; to: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(shareTips, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">How to share</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="method" value="hours" defaultChecked /> By hours worked (recommended)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="method" value="equal" /> Equally between everyone who worked
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className={button}>{pending ? "Sharing…" : label}</button>
    </form>
  );
}

export function PolicyForm({ policy }: { policy: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTippingPolicy, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your tipping policy</span>
        <textarea name="policy" rows={14} defaultValue={policy} className={`${input} font-sans text-sm`} />
      </label>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Save policy"}</button>
    </form>
  );
}
