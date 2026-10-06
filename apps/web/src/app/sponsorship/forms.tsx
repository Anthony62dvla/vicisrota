"use client";

import { useActionState } from "react";
import { markReported, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function ReportedForm({ workerId, kind, eventDate, today }: { workerId: string; kind: string; eventDate: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(markReported, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <input type="hidden" name="workerId" value={workerId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="eventDate" value={eventDate} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Reported on</span>
          <input name="reportedOn" type="date" defaultValue={today} max={today} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Reference (optional)</span>
          <input name="reference" maxLength={60} autoComplete="off" className={input} />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
          {pending ? "Saving…" : "Mark as reported"}
        </button>
      </div>
    </form>
  );
}
