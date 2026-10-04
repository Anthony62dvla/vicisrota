"use client";

import { useActionState } from "react";
import { addShift, checkAndPublish, copyPreviousWeek, decideClaim, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

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

export function AddShiftForm({
  workers,
  days,
  training,
  roles,
  clients,
}: {
  workers: { id: string; name: string }[];
  days: string[];
  training: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  /** Care providers only: clients a shift can be a visit to. */
  clients?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addShift, {});
  return (
    <form action={action} className="mt-10 flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">Add a shift</h2>
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who is working</span>
        <select name="workerId" className={input}>
          <option value="">Nobody yet: an open shift staff can pick up</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </label>
      {roles.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Job role</span>
          <select name="roleId" className={input}>
            <option value="">No particular role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
      )}
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
      {clients && (
        <>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Visit to (optional)</span>
            <select name="clientId" defaultValue="" className={input}>
              <option value="">Not a visit</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Travel time from the previous visit (minutes)</span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Travel between visits counts as working time for the minimum wage.</span>
            <input name="travelMinutes" type="number" min={0} max={240} defaultValue={0} className={input} />
          </label>
        </>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Working alone</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="loneWorking" /> This person will be working on their own
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">They check in at the start, at this interval, and at the end. You see who is late.</span>
          <select name="checkInMinutes" defaultValue="60" aria-label="Check in every" className={input}>
            {[30, 60, 90, 120].map((m) => (
              <option key={m} value={m}>Check in every {m < 60 ? `${m} minutes` : m === 60 ? "hour" : `${m / 60} hours`}</option>
            ))}
          </select>
        </label>
      </fieldset>
      {training.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">Training this shift needs</legend>
          {training.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input type="checkbox" name="requires" value={t.id} /> {t.name}
            </label>
          ))}
        </fieldset>
      )}
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Adding…" : "Add shift"}
      </button>
    </form>
  );
}

type Claim = { id: string; name: string; when: string; kind: "open" | "cover"; warnings: string[] };

/** Requests from staff to pick up open shifts or cover colleagues, with one message area for the list. */
export function ClaimList({ claims }: { claims: Claim[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideClaim, {});
  return (
    <div className="mt-3 flex flex-col gap-2">
      <Message state={state} />
      {claims.length === 0 ? (
        <p>No requests waiting.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-500 p-3">
              <div>
                <p className="font-medium">
                  {c.name} would like {c.kind === "cover" ? "to cover" : "to pick up"} {c.when}
                </p>
                {c.warnings.map((w, i) => (
                  <p key={i} className="text-sm">Check: {w}</p>
                ))}
              </div>
              <form action={action} className="flex gap-2">
                <input type="hidden" name="claimId" value={c.id} />
                <button type="submit" name="decision" value="approve" disabled={pending} className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Approve</button>
                <button type="submit" name="decision" value="decline" disabled={pending} className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Decline</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CopyWeekForm({ weekStart, count }: { weekStart: string; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(copyPreviousWeek, {});
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="weekStart" value={weekStart} />
      <Message state={state} />
      <button type="submit" disabled={pending} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        {pending ? "Copying…" : `Copy last week's ${count} shift${count === 1 ? "" : "s"} as drafts`}
      </button>
    </form>
  );
}
