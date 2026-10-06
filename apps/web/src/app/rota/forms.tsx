"use client";

import { useActionState } from "react";
import { checkAndPublish, copyPreviousWeek, decideClaim, decideSwap, fillOpenShifts, saveSalesTargets, type FormState } from "./actions";

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

/** Fills this week's open draft shifts with people who fit, then leaves the week as drafts to look over. */
export function FillOpenShiftsForm({ weekStart, open }: { weekStart: string; open: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(fillOpenShifts, {});
  return (
    <form action={action} className="mt-3 flex flex-col items-start gap-3">
      <input type="hidden" name="weekStart" value={weekStart} />
      <Message state={state} />
      <button type="submit" disabled={pending || open === 0} className="rounded-lg border-2 border-brand px-4 py-2 font-medium disabled:opacity-60">
        {pending ? "Finding the best fit…" : open === 0 ? "No open draft shifts to fill" : `Fill ${open === 1 ? "the open shift" : `the ${open} open shifts`} automatically`}
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

type Swap = { id: string; summary: string; note: string | null; warnings: string[] };

/** Swaps two people have agreed between themselves, waiting for a manager. */
export function SwapList({ swaps }: { swaps: Swap[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(decideSwap, {});
  return (
    <div className="mt-3 flex flex-col gap-2">
      <Message state={state} />
      {swaps.length === 0 ? (
        <p>No swaps waiting.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {swaps.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-500 p-3">
              <div>
                <p className="font-medium">{s.summary}</p>
                {s.note && <p className="text-sm">Their note: {s.note}</p>}
                {s.warnings.map((w, i) => (
                  <p key={i} className="text-sm">Check: {w}</p>
                ))}
              </div>
              <form action={action} className="flex gap-2">
                <input type="hidden" name="swapId" value={s.id} />
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

/** Expected sales for each day, and the most wages should be as a share of them. */
export function SalesTargetsForm({ weekStart, days, targetPercent }: { weekStart: string; days: { date: string; label: string; pounds: string }[]; targetPercent: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSalesTargets, {});
  return (
    <form action={action} className="mt-3 flex flex-col items-start gap-3">
      <input type="hidden" name="weekStart" value={weekStart} />
      <Message state={state} />
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-1 font-medium">Expected sales (£)</legend>
        {days.map((d) => (
          <label key={d.date} className="flex flex-col gap-1">
            <span className="text-sm">{d.label}</span>
            <input name={`sales-${d.date}`} defaultValue={d.pounds} inputMode="decimal" className="w-28 rounded-lg border border-zinc-400 px-3 py-2" />
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Target: wages as a share of sales (%)</span>
        <input name="targetPercent" defaultValue={targetPercent ?? ""} inputMode="numeric" className="w-28 rounded-lg border border-zinc-400 px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className={button}>
        {pending ? "Saving…" : "Save sales targets"}
      </button>
    </form>
  );
}
