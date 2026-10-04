"use client";

import { useActionState } from "react";
import { LATE_ALERT_CHOICES } from "@/lib/attendance-choices";
import { setLateAlerts, type FormState } from "./actions";

export function LateAlertsForm({ minutes }: { minutes: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setLateAlerts, {});
  return (
    <form action={action} className="mt-3 flex max-w-md flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Text when someone has not clocked in</span>
        <select name="minutes" defaultValue={minutes === null ? "off" : String(minutes)} className="rounded-lg border border-zinc-400 px-3 py-2 text-base">
          <option value="off">Do not send texts</option>
          {LATE_ALERT_CHOICES.map((m) => (
            <option key={m} value={m}>{m === 60 ? "1 hour" : `${m} minutes`} after their shift starts</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
