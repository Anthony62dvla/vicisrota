"use client";

import { useActionState } from "react";
import { qrClock, type QrClockState } from "./actions";

const LABEL = { in: "Clock in", break_start: "Start break", break_end: "End break", out: "Clock out" } as const;

export type QrShift = { shiftId: string; times: string; status: string; actions: (keyof typeof LABEL)[] };

/** Big buttons for each next step on each shift. After it works, the buttons go away so nothing is pressed twice. */
export function QrClockForm({ code, shift }: { code: { k: string; w: string; s: string }; shift: QrShift }) {
  const [state, action, pending] = useActionState<QrClockState, FormData>(qrClock, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="k" value={code.k} />
      <input type="hidden" name="w" value={code.w} />
      <input type="hidden" name="s" value={code.s} />
      <input type="hidden" name="shiftId" value={shift.shiftId} />
      {state.ok ? (
        <p role="status" className="rounded-xl border-2 border-green-600 p-4 text-xl">{state.ok}</p>
      ) : (
        <>
          {state.error && <p role="alert" className="rounded-xl border-2 border-red-500 p-4 text-lg">{state.error}</p>}
          <div className="flex flex-wrap gap-3">
            {shift.actions.map((kind) => (
              <button
                key={kind}
                type="submit"
                name="kind"
                value={kind}
                disabled={pending}
                className={`rounded-xl px-6 py-4 text-xl font-medium disabled:opacity-60 ${kind === shift.actions[0] ? "bg-brand text-on-brand hover:bg-brand-hover" : "border border-zinc-400 hover:bg-brand-soft"}`}
              >
                {pending ? "Saving…" : LABEL[kind]}
              </button>
            ))}
          </div>
        </>
      )}
    </form>
  );
}
