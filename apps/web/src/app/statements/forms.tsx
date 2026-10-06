"use client";

import { useActionState } from "react";
import { giveStatement, saveTerms, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function TermsForm({ payInterval, fields }: { payInterval: string; fields: { key: string; label: string; value: string; fallback: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTerms, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <Message state={state} />
      <label className="flex max-w-xs flex-col gap-1">
        <span className="font-medium">How often people are paid</span>
        <select name="payInterval" defaultValue={payInterval} className={input}>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Every 2 weeks</option>
          <option value="four-weekly">Every 4 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="font-medium">{f.label}</span>
          <textarea name={f.key} defaultValue={f.value} placeholder={f.fallback} rows={2} maxLength={1000} className={input} />
        </label>
      ))}
      <p className="text-sm text-muted">Leave a box empty to use the wording shown in it.</p>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Save terms"}</button>
    </form>
  );
}

export function GiveForm({
  workerId,
  values,
}: {
  workerId: string;
  values: { jobTitle: string; startDate: string; hours: string; placeOfWork: string };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(giveStatement, {});
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Job title</span>
        <input name="jobTitle" defaultValue={values.jobTitle} maxLength={200} className={input} />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Start date</span>
          <input name="startDate" type="date" defaultValue={values.startDate} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Continuous employment from (optional)</span>
          <input name="continuousFrom" type="date" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Temporary until (optional)</span>
          <input name="temporaryUntil" type="date" className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Working hours and days</span>
        <span className="text-sm text-muted">For example: 37.5 hours a week, Monday to Friday. Or: your hours vary, and shifts are set on the published rota.</span>
        <textarea name="hours" defaultValue={values.hours} rows={2} maxLength={1000} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Place of work</span>
        <textarea name="placeOfWork" defaultValue={values.placeOfWork} rows={2} maxLength={1000} className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Give statement"}</button>
    </form>
  );
}
