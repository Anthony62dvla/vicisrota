"use client";

import { useActionState } from "react";
import { addWorker, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function AddWorkerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addWorker, {});
  return (
    <form action={action} className="mt-8 flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">Add a person</h2>
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Full name</span>
        <input name="fullName" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date of birth</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Used for minimum wage bands and under-18 rules.</span>
        <input name="dateOfBirth" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Hourly rate (£)</span>
        <input name="hourlyRate" inputMode="decimal" required placeholder="12.71" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Rate starts on</span>
        <input name="rateFrom" type="date" required className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input name="optedOut" type="checkbox" /> Has signed an opt-out from the 48-hour week
      </label>
      <label className="flex items-center gap-2">
        <input name="apprentice" type="checkbox" /> Paid the apprentice rate
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}
