"use client";

import { useActionState } from "react";
import { addStaffingLevel, type FormState } from "./actions";

// Kept here rather than imported from lib/staffing, which pulls in the database code.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

type Option = { id: string; name: string };

export function AddStaffingLevelForm({ workplaces, roles }: { workplaces: Option[]; roles: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addStaffingLevel, {});
  return (
    <form action={action} className="mt-3 flex max-w-xl flex-col gap-5">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Where</span>
        <select name="locationId" className={input} defaultValue="">
          <option value="">Across the whole business</option>
          {workplaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who counts</span>
        <span className="text-sm text-muted">Pick a job role to make sure the right skills are on, such as a senior or a first aider.</span>
        <select name="roleId" className={input} defaultValue="">
          <option value="">Anyone on shift</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>{r.name} only</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">At least how many people</span>
        <input name="minPeople" type="number" inputMode="numeric" min={1} max={99} defaultValue={2} required className={`${input} w-28`} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Which days</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-2">
              <input type="checkbox" name="weekday" value={i + 1} defaultChecked className="h-5 w-5" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">From</span>
          <input name="startsAt" type="time" defaultValue="08:00" required className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">To</span>
          <input name="endsAt" type="time" defaultValue="20:00" required className={input} />
        </label>
      </div>
      <p className="-mt-3 text-sm text-muted">For nights, an earlier end time means the next morning, such as 20:00 to 08:00. The same start and end time means all day.</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="strict" defaultChecked className="mt-1 h-5 w-5" />
        <span>
          <span className="font-medium">Stop the rota going out if it falls short</span>
          <span className="block text-sm text-muted">Untick this to show a reminder instead.</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Adding…" : "Add staffing level"}
      </button>
    </form>
  );
}
