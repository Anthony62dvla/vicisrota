"use client";

import { useActionState, useState } from "react";
import { requestTimeOff, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function TimeOffForm({ unit, kinds }: { unit: "days" | "hours"; kinds: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestTimeOff, {});
  const [kind, setKind] = useState("annual");
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">What kind of time off?</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">First day off</span>
        <input name="startsOn" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Last day off</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty if it is just one day.</span>
        <input name="endsOn" type="date" className={input} />
      </label>
      {kind === "annual" && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{unit === "hours" ? "How many hours of holiday?" : "How many working days of holiday?"}</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {unit === "hours" ? "Your holiday is counted in hours." : "Only count days you would normally work. Half days are fine, for example 2.5."}
          </span>
          <input name="amount" inputMode="decimal" required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Anything your manager should know? (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">You do not have to give a reason or any medical details.</span>
        <textarea name="note" rows={2} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}
