"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { leaveHandover, setTick, type FormState } from "./actions";

/** One checklist. Each tick saves straight away; untick if it was a mistake. */
export function TickList({ shiftId, templateId, items, done }: { shiftId: string; templateId: string; items: string[]; done: number[] }) {
  const [ticked, setTicked] = useOptimistic(new Set(done), (current: Set<number>, change: { item: number; on: boolean }) => {
    const next = new Set(current);
    if (change.on) next.add(change.item);
    else next.delete(change.item);
    return next;
  });
  const [, start] = useTransition();
  return (
    <>
      <p className="mt-1 text-sm text-muted" aria-live="polite">
        {ticked.size} of {items.length} done
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((task, item) => (
          <li key={item}>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={ticked.has(item)}
                onChange={(e) => {
                  const on = e.target.checked;
                  start(async () => {
                    setTicked({ item, on });
                    await setTick(shiftId, templateId, item, on);
                  });
                }}
              />
              <span className={ticked.has(item) ? "text-muted line-through" : ""}>{task}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

export function HandoverForm({ shiftId, max }: { shiftId: string; max: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(leaveHandover, {});
  return (
    <form key={state.ok ?? "form"} action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="shiftId" value={shiftId} />
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Note for the next shift</span>
        <span className="text-sm text-muted">What they need to know: anything unfinished, running low or to keep an eye on.</span>
        <textarea name="body" rows={4} maxLength={max} defaultValue={state.values?.body ?? ""} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        Save handover
      </button>
    </form>
  );
}
