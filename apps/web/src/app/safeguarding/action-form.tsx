"use client";

import { useActionState } from "react";
import { CONCERN_STATUS_LABEL, type ConcernStatus, type FormState } from "@/lib/concern-labels";
import { recordConcernAction } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function ConcernActionForm({ concernId, status }: { concernId: string; status: ConcernStatus }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordConcernAction, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <input type="hidden" name="concernId" value={concernId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">What was done or decided?</span>
        <textarea name="note" rows={3} required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Referred to (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">For example the council safeguarding team, CQC, the police or the LADO.</span>
        <input name="referredTo" maxLength={200} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Status</span>
        <select name="status" defaultValue={status} className={input}>
          {Object.entries(CONCERN_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        {pending ? "Saving…" : "Add to record"}
      </button>
    </form>
  );
}
