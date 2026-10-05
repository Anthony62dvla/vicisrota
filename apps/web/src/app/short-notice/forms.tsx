"use client";

import { useActionState } from "react";
import { NOTICE_HOUR_CHOICES, PAY_PERCENT_CHOICES } from "@/lib/short-notice-choices";
import { setShortNotice, waivePayment, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

const Result = ({ state }: { state: FormState }) => (
  <>
    {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
    {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
  </>
);

const noticeLabel = (h: number) => (h === 168 ? "1 week" : h % 24 === 0 && h > 24 ? `${h / 24} days (${h} hours)` : `${h} hours`);

export function ShortNoticeForm({ hours, percent }: { hours: number | null; percent: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setShortNotice, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Result state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Pay staff when a shift changes with less notice than</span>
        <select name="hours" defaultValue={hours === null ? "off" : String(hours)} className={input}>
          <option value="off">Off: do not pay for short-notice changes</option>
          {NOTICE_HOUR_CHOICES.map((h) => (
            <option key={h} value={h}>{noticeLabel(h)}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">How much of the lost pay</span>
        <select name="percent" defaultValue={String(percent)} className={input}>
          {PAY_PERCENT_CHOICES.map((p) => (
            <option key={p} value={p}>{p === 100 ? "Full pay for the time lost" : `${p}% of the pay for the time lost`}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function WaiveForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(waivePayment, {});
  if (state.ok) return <p role="status" className="mt-2 text-sm">{state.ok}</p>;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-sm underline">This is not owed</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <Result state={state} />
        <input type="hidden" name="id" value={id} />
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Why is {name} not owed this?</span>
          <input name="reason" required maxLength={300} placeholder="For example: they asked to swap" className={input} />
        </label>
        <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-3 py-1.5 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Mark as not owed"}
        </button>
      </form>
    </details>
  );
}
