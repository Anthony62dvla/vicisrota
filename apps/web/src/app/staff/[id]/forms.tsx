"use client";

import { useActionState, useState } from "react";
import { addCheck, addTraining, updateHolidaySettings, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function AddCheckForm({ workerId }: { workerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addCheck, {});
  const [kind, setKind] = useState("right_to_work");
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Record a check</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Type of check</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          <option value="right_to_work">Right to work</option>
          <option value="dbs">DBS</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Date checked</span>
        <input name="checkedOn" type="date" required className={input} />
      </label>
      {kind === "right_to_work" ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Follow-up check due (if permission is time-limited)</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty for British or Irish citizens and settled status.</span>
          <input name="expiresOn" type="date" className={input} />
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="font-medium">DBS level</span>
          <select name="dbsLevel" defaultValue="enhanced_barred" className={input}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="enhanced">Enhanced</option>
            <option value="enhanced_barred">Enhanced with barred list</option>
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Reference (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Share code or certificate number.</span>
        <input name="reference" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save check"}
      </button>
    </form>
  );
}

export function AddTrainingForm({ workerId, known }: { workerId: string; known: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTraining, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Record training</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Training or qualification</span>
        <input name="name" list="known-training" required placeholder="Food hygiene level 2" className={input} />
        <datalist id="known-training">
          {known.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Achieved on (optional)</span>
        <input name="achievedOn" type="date" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Expires on (optional)</span>
        <input name="expiresOn" type="date" className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save training"}
      </button>
    </form>
  );
}

export function HolidaySettingsForm({
  workerId,
  employmentStart,
  daysPerWeek,
  irregularHours,
}: {
  workerId: string;
  employmentStart: string | null;
  daysPerWeek: number;
  irregularHours: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateHolidaySettings, {});
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      <h3 className="font-semibold">Holiday settings</h3>
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Start date (optional)</span>
        <input name="employmentStart" type="date" defaultValue={employmentStart ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Usual days worked a week</span>
        <input name="daysPerWeek" type="number" min={0.5} max={7} step={0.5} defaultValue={daysPerWeek} className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input name="irregularHours" type="checkbox" defaultChecked={irregularHours} /> Works irregular hours (holiday counted in hours)
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save holiday settings"}
      </button>
    </form>
  );
}
