"use client";

import { useActionState } from "react";
import { slotText, weekdayName, WEEKDAYS } from "@/lib/availability-labels";

type State = { error?: string; ok?: string; values?: Record<string, string> };
const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

/**
 * Lists the weekly times someone cannot work, with a form to add more. Used on the person's own
 * page and on their staff record, with that page's own actions.
 */
export function AvailabilityEditor({
  slots,
  add,
  remove,
  workerId,
  you,
}: {
  slots: { id: string; weekday: number; startsAt: string; endsAt: string }[];
  add: (state: State, form: FormData) => Promise<State>;
  remove: (form: FormData) => Promise<void>;
  workerId?: string;
  /** Wording for the person's own page ("you") or a manager's view ("they"). */
  you: boolean;
}) {
  const [state, action, pending] = useActionState(add, {});
  const v = state.values;
  return (
    <div className="mt-2 flex flex-col gap-4">
      {slots.length === 0 ? (
        <p>{you ? "You have not added any times you can't work." : "No times added."}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
              <span>
                {weekdayName(s.weekday)}s, {slotText(s.startsAt, s.endsAt)}
              </span>
              <form action={remove}>
                <input type="hidden" name="id" value={s.id} />
                {workerId && <input type="hidden" name="workerId" value={workerId} />}
                <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1">
                  Remove<span className="sr-only">: {weekdayName(s.weekday)}s, {slotText(s.startsAt, s.endsAt)}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form key={JSON.stringify(v ?? {})} action={action} className="flex flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <p className="font-medium">Add a time {you ? "you" : "they"} can&apos;t work</p>
        {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
        {workerId && <input type="hidden" name="workerId" value={workerId} />}
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span>Day</span>
            <select name="weekday" defaultValue={v?.weekday ?? "1"} className={input}>
              {WEEKDAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}s</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span>From</span>
            <input name="from" type="time" defaultValue={v?.from ?? ""} className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span>To</span>
            <input name="to" type="time" defaultValue={v?.to ?? ""} className={input} />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allDay" defaultChecked={v?.allDay === "on"} /> All day
        </label>
        <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
    </div>
  );
}
