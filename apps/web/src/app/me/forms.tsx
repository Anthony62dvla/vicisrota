"use client";

import { useActionState, useState } from "react";
import { askToPickUp, clock, loneCheckIn, requestTimeOff, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function TimeOffForm({ unit, kinds }: { unit: "days" | "hours"; kinds: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestTimeOff, {});
  const [kind, setKind] = useState("annual");
  return (
    <form action={action} className="mt-4 flex max-w-md flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">What kind of time off?</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">First day off</span>
        <input name="startsOn" type="date" required className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Last day off</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty if it is just one day.</span>
        <input name="endsOn" type="date" className={input} />
      </label>
      {kind === "annual" && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{unit === "hours" ? "How many hours of holiday?" : "How many working days of holiday?"}</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {unit === "hours" ? "Your holiday is counted in hours." : "Only count days you would normally work. Half days are fine, for example 2.5."}
          </span>
          <input name="amount" inputMode="decimal" required className={input} />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Anything your manager should know? (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">You do not have to give a reason or any medical details.</span>
        <textarea name="note" rows={2} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}

/** Shifts this person could pick up, each checked against the law when they ask. */
export function PickUpList({ shifts }: { shifts: { id: string; when: string; detail: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(askToPickUp, {});
  return (
    <div className="mt-3 flex flex-col gap-2">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <ul className="flex flex-col gap-2">
        {shifts.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
            <div>
              <p className="font-medium">{s.when}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.detail}</p>
            </div>
            <form action={action}>
              <input type="hidden" name="shiftId" value={s.id} />
              <button type="submit" disabled={pending} className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Ask to pick up</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Big, clear check-in buttons for someone working alone. Asking for help needs a second tap, to avoid accidents. */
export function LoneCheckIn({ shiftId, started }: { shiftId: string; started: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loneCheckIn, {});
  const [askingHelp, setAskingHelp] = useState(false);
  const button = "rounded-lg px-4 py-3 text-base font-medium disabled:opacity-60";
  return (
    <div className="mt-3 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <form action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="shiftId" value={shiftId} />
        {!started ? (
          <button type="submit" name="kind" value="start" disabled={pending} className={`${button} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`}>I have started</button>
        ) : (
          <>
            <button type="submit" name="kind" value="ok" disabled={pending} className={`${button} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900`}>I am OK</button>
            <button type="submit" name="kind" value="finished" disabled={pending} className={`${button} border border-zinc-400`}>I have finished safely</button>
          </>
        )}
        {!askingHelp && (
          <button type="button" onClick={() => setAskingHelp(true)} className={`${button} border-2 border-red-600 text-red-700 dark:text-red-400`}>I need help</button>
        )}
      </form>
      {askingHelp && (
        <form action={action} className="flex flex-col gap-3 rounded-lg border-2 border-red-600 p-3">
          <p className="font-medium">If you are in danger, call 999 now.</p>
          <input type="hidden" name="shiftId" value={shiftId} />
          <label className="flex flex-col gap-1">
            <span>What is happening? (optional)</span>
            <input name="note" maxLength={1000} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" name="kind" value="help" disabled={pending} className={`${button} bg-red-700 text-white`}>Alert my manager</button>
            <button type="button" onClick={() => setAskingHelp(false)} className={`${button} border border-zinc-400`}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

const CLOCK_LABEL = { in: "Clock in", break_start: "Start break", break_end: "End break", out: "Clock out" } as const;

/** Only the buttons that make sense right now, large enough to tap easily. */
export function ClockButtons({ shiftId, actions }: { shiftId: string; actions: (keyof typeof CLOCK_LABEL)[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(clock, {});
  return (
    <div className="mt-3 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      {actions.length > 0 && (
        <form action={action} className="flex flex-wrap gap-3">
          <input type="hidden" name="shiftId" value={shiftId} />
          {actions.map((k, i) => (
            <button
              key={k}
              type="submit"
              name="kind"
              value={k}
              disabled={pending}
              className={`rounded-lg px-5 py-3 text-base font-medium disabled:opacity-60 ${i === 0 ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-400"}`}
            >
              {CLOCK_LABEL[k]}
            </button>
          ))}
        </form>
      )}
    </div>
  );
}
