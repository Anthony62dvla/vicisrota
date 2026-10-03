"use client";

import { useActionState, useState } from "react";
import { bookLeave, decideLeave, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function BookLeaveForm({
  workers,
  kinds,
}: {
  workers: { id: string; name: string; unit: "days" | "hours" }[];
  kinds: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(bookLeave, {});
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [kind, setKind] = useState("annual");
  const unit = workers.find((w) => w.id === workerId)?.unit ?? "days";
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who</span>
        <select name="workerId" value={workerId} onChange={(e) => setWorkerId(e.target.value)} className={input}>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Type of leave</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">First day</span>
          <input name="startsOn" type="date" required className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">Last day</span>
          <input name="endsOn" type="date" className={input} />
        </label>
      </div>
      {kind === "annual" && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{unit === "hours" ? "Hours of holiday used" : "Working days of holiday used"}</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {unit === "hours" ? "This person works irregular hours, so holiday is counted in hours." : "Only count days they would normally work. Half days are fine, for example 2.5."}
          </span>
          <input name="amount" inputMode="decimal" required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Note (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Only managers see this. Avoid medical details unless they are needed.</span>
        <textarea name="note" rows={2} className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input name="approveNow" type="checkbox" defaultChecked /> Approve it now
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Book leave"}
      </button>
    </form>
  );
}

type Item = { id: string; title: string; detail: string; options: { decision: string; label: string }[] };

/** One message for the whole list, so it stays on screen after the decided item leaves the list. */
export function DecisionList({ items, empty, tone }: { items: Item[]; empty: string; tone: "pending" | "booked" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideLeave, {});
  return (
    <div className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      {items.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-start justify-between gap-4 rounded-lg border p-3 ${tone === "pending" ? "border-amber-500" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm">{item.detail}</p>
              </div>
              <form action={action} className="flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                {item.options.map((o) => (
                  <button
                    key={o.decision}
                    type="submit"
                    name="decision"
                    value={o.decision}
                    disabled={pending}
                    className="rounded-lg border border-zinc-400 px-3 py-1 text-sm disabled:opacity-60"
                  >
                    {o.label}
                  </button>
                ))}
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
