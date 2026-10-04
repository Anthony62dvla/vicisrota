"use client";

import { useActionState, useState } from "react";
import { addCheck, addTraining, inviteStaff, saveAdjustments, setMobile, updateHolidaySettings, type FormState, type InviteState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

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

/** mobile is shown formatted, e.g. "07700 900123", or null when none is saved. */
export function InviteForm({ workerId, name, mobile }: { workerId: string; name: string; mobile: string | null }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteStaff, {});
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      {state.link && (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={state.link} aria-label="Invitation link" className={`${input} min-w-0 flex-1 font-mono text-sm`} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="rounded-lg border border-zinc-400 px-3 py-2"
            onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {mobile && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="byText" defaultChecked /> Text the link to {mobile}
        </label>
      )}
      <button type="submit" disabled={pending} className={`${button} self-start`}>
        {pending ? "Creating link…" : state.link ? "Create a new link" : `Invite ${name} to log in`}
      </button>
    </form>
  );
}

export function MobileForm({ workerId, mobile }: { workerId: string; mobile: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setMobile, {});
  return (
    <form key={state.values?.mobile ?? ""} action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">UK mobile</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Used to text them their invitation. Leave empty to remove it.</span>
        <input name="mobile" type="tel" autoComplete="off" defaultValue={state.values?.mobile ?? mobile ?? ""} placeholder="07700 900123" className={`${input} max-w-xs`} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2">
        {pending ? "Saving…" : "Save number"}
      </button>
    </form>
  );
}

export function AdjustmentsForm({ workerId, current }: { workerId: string; current: { maxShiftHours?: number; earliestStart?: string; latestFinish?: string; note?: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveAdjustments, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <input type="hidden" name="workerId" value={workerId} />
      <Message state={state} />
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Longest shift (hours)</span>
          <input name="maxShiftHours" inputMode="decimal" defaultValue={v?.maxShiftHours ?? current.maxShiftHours ?? ""} className={`${input} w-28`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Start no earlier than</span>
          <input name="earliestStart" type="time" defaultValue={v?.earliestStart ?? current.earliestStart ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Finish by</span>
          <input name="latestFinish" type="time" defaultValue={v?.latestFinish ?? current.latestFinish ?? ""} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">What was agreed and why (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Only managers and this person can see this. It is never shown on the rota.</span>
        <textarea name="note" rows={3} defaultValue={v?.note ?? current.note ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className={`${button} self-start`}>{pending ? "Saving…" : "Save adjustments"}</button>
    </form>
  );
}
