"use client";

import { useActionState } from "react";
import { addShift, checkAndPublish, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function PublishForm({ weekStart }: { weekStart: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(checkAndPublish, {});
  return (
    <form action={action} className="mt-3 flex flex-col items-start gap-3">
      <input type="hidden" name="weekStart" value={weekStart} />
      <Message state={state} />
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Checking…" : "Check and publish this week"}
      </button>
    </form>
  );
}

export function AddShiftForm({ workers, days }: { workers: { id: string; name: string }[]; days: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addShift, {});
  return (
    <form action={action} className="mt-10 flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">Add a shift</h2>
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who is working</span>
        <select name="workerId" required className={input}>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Day</span>
        <select name="date" required className={input}>
          {days.map((d) => (
            <option key={d} value={d}>
              {new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">Starts</span>
          <input name="start" type="time" required className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">Finishes</span>
          <input name="end" type="time" required className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Unpaid break (minutes)</span>
        <input name="breakMinutes" type="number" min={0} max={240} defaultValue={0} className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Adding…" : "Add shift"}
      </button>
    </form>
  );
}
