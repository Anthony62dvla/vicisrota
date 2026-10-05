"use client";

import { useActionState, useState } from "react";
import { createJobPost, hireApplicant, updateApplicant, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const primary = "self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

const Messages = ({ state }: { state: FormState }) => (
  <>
    {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
    {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
  </>
);

export function JobPostForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJobPost, {});
  const v = state.values;
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <Messages state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Job title</span>
        <input name="title" defaultValue={v?.title ?? ""} placeholder="For example, Care worker" className={`${input} max-w-sm`} />
      </label>
      {roles.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Job role on the rota (optional)</span>
          <select name="roleId" defaultValue={v?.roleId ?? ""} className={`${input} max-w-sm`}>
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Where</span>
          <input name="place" defaultValue={v?.place ?? ""} placeholder="Town or workplace" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Hours</span>
          <input name="hours" defaultValue={v?.hours ?? ""} placeholder="For example, 30 hours a week" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Pay</span>
          <input name="pay" defaultValue={v?.pay ?? ""} placeholder="For example, £12.71 an hour" className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-medium">About the job</span>
        <span className="text-sm text-muted">
          Plain words and short sentences help everyone. Say what a normal day looks like, what you will train, and what really matters. Ask
          only for what the job truly needs.
        </span>
        <textarea name="description" rows={8} defaultValue={v?.description ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className={primary}>
        Create the advert
      </button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input readOnly value={url} aria-label="Link to the advert" className={`${input} min-w-0 flex-1`} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="rounded-lg border border-zinc-400 px-4 py-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function ApplicantForm({ id, status, notes, statuses }: { id: string; status: string; notes: string; statuses: [string, string][] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateApplicant, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Messages state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Where they are up to</span>
        <select name="status" defaultValue={status} className={`${input} max-w-xs`}>
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your notes</span>
        <span className="text-sm text-muted">The applicant can ask to see these, so keep them factual and kind.</span>
        <textarea name="notes" rows={3} defaultValue={notes} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2">
        Save
      </button>
    </form>
  );
}

export function HireForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(hireApplicant, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <Messages state={state} />
      <p>This adds {name} to your staff. You then check their right to work and send their invitation.</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Date of birth</span>
          <input type="date" name="dateOfBirth" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Start date</span>
          <input type="date" name="employmentStart" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Hourly rate (£)</span>
          <input name="hourlyRate" inputMode="decimal" className={`${input} w-32`} />
        </label>
      </div>
      <button type="submit" disabled={pending} className={primary}>
        Take {name} on
      </button>
    </form>
  );
}
