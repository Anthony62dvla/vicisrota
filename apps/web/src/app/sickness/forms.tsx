"use client";

import { useActionState } from "react";
import { recordFitNote, recordSickness, setLastSickDay, setSspEarnings, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";
const small = "self-start rounded-lg border border-zinc-500 px-3 py-1 disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function RecordSicknessForm({ workers, today }: { workers: { id: string; name: string }[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordSickness, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who</span>
        <select name="workerId" defaultValue={v?.workerId ?? ""} className={input}>
          <option value="">Choose someone</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">First day off sick</span>
          <input name="startsOn" type="date" defaultValue={v?.startsOn ?? today} className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-medium">Last day off sick</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty for one day. You can change it later.</span>
          <input name="endsOn" type="date" defaultValue={v?.endsOn ?? ""} className={input} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Record sickness"}</button>
    </form>
  );
}

export function LastDayForm({ id, endsOn, name }: { id: string; endsOn: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setLastSickDay, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Last day off sick</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Change this when {name} is back, or if they are off for longer.</span>
        <input name="endsOn" type="date" defaultValue={endsOn} className={input} />
      </label>
      <button type="submit" disabled={pending} className={small}>{pending ? "Saving…" : "Save last day"}</button>
    </form>
  );
}

export function FitNoteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(recordFitNote, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={small}>{pending ? "Saving…" : "We have their fit note"}</button>
    </form>
  );
}

export function EarningsForm({ id, pounds, estimate }: { id: string; pounds: string; estimate: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setSspEarnings, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Average weekly earnings (£)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Gross pay over the 8 weeks before they went off sick, divided by 8. Your payroll can give you this. Leave empty to use
          VicisRota&apos;s estimate from confirmed hours ({estimate}).
        </span>
        <input name="pounds" inputMode="decimal" defaultValue={pounds} className={input} />
      </label>
      <button type="submit" disabled={pending} className={small}>{pending ? "Saving…" : "Save earnings"}</button>
    </form>
  );
}
