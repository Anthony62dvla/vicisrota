"use client";

import { useActionState } from "react";
import { checkAndPublish, copyPreviousWeek, decideClaim, type FormState } from "./actions";

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
