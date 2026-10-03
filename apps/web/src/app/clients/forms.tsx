"use client";

import { useActionState } from "react";
import { addClient, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function AddClientForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addClient, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Use the name they like to be called.</span>
        <input name="name" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Postcode (optional)</span>
        <input name="postcode" autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Notes for visiting carers (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          For example, where to park or how to get in. Only carers with a visit to this person see these. Keep care plans in your care
          planning system.
        </span>
        <textarea name="visitNotes" rows={3} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Adding…" : "Add client"}
      </button>
    </form>
  );
}
