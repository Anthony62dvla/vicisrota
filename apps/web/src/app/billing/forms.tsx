"use client";

import { useActionState } from "react";
import { askCharityPrice, choosePlan, type FormState } from "./actions";

const button = "rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-hover disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function ChoosePlanForm({ month, year, upTo }: { month: string; year: string; upTo: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(choosePlan, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <p>Your team fits the band for up to {upTo} people. You pay through Stripe, and can cancel at any time.</p>
      <Message state={state} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="interval" value="month" disabled={pending} className={button}>
          Pay {month} a month
        </button>
        <button type="submit" name="interval" value="year" disabled={pending} className={button}>
          Pay {year} a year
        </button>
      </div>
    </form>
  );
}

export function CharityForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(askCharityPrice, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Charity number, or company number for a CIC</span>
        <input name="number" required maxLength={12} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <button type="submit" disabled={pending} className={`${button} self-start`}>
        Ask for half price
      </button>
    </form>
  );
}
