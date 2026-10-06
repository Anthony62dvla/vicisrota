"use client";

import { useActionState } from "react";
import { confirmAsRostered, confirmClockedHours, saveActualHours, sendToXero, setPayItemNames, setSleepInPay, undoConfirmation, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const small = "rounded-lg border border-zinc-400 px-3 py-1 text-sm disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export type Row = {
  shiftId: string;
  name: string;
  day: string;
  rostered: string;
  rosteredBreak: number;
  /** Care: a sleep-in, where only time woken to work is paid by the hour. */
  sleepIn: boolean;
  /** Set once hours are confirmed. */
  confirmed?: { entryId: string; times: string; breakMinutes: number; awakeMinutes: number; hours: string; differs: boolean; start: string; end: string; note: string | null };
  defaults: { start: string; end: string; breakMinutes: number };
  /** What the person clocked, when they used clock-in. */
  clocked?: { text: string; flags: string[]; complete: boolean };
};

/** One message area for the whole list, so feedback stays visible after a row changes. */
export function TimesheetList({ rows }: { rows: Row[] }) {
  const [confirmState, confirm, confirming] = useActionState<FormState, FormData>(confirmAsRostered, {});
  const [saveState, save, saving] = useActionState<FormState, FormData>(saveActualHours, {});
  const [clockState, useClocked, usingClocked] = useActionState<FormState, FormData>(confirmClockedHours, {});
  const waiting = rows.filter((r) => !r.confirmed);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <Message state={confirmState} />
      <Message state={saveState} />
      <Message state={clockState} />
      {waiting.length > 1 && (
        <form action={confirm}>
          {waiting.map((r) => (
            <input key={r.shiftId} type="hidden" name="shiftId" value={r.shiftId} />
          ))}
          <button type="submit" disabled={confirming} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
            {confirming ? "Confirming…" : `Confirm all ${waiting.length} as rostered`}
          </button>
        </form>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.shiftId}
            className={`rounded-lg border p-3 ${r.confirmed ? "border-zinc-300 dark:border-zinc-700" : "border-amber-500"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.name} · {r.day}{r.sleepIn && " · Sleep-in"}</p>
                <p className="text-sm">
                  Rostered {r.rostered}{r.rosteredBreak ? `, ${r.rosteredBreak} min break` : ""}
                </p>
                {r.clocked && (
                  <p className="text-sm">
                    {r.clocked.text}
                    {r.clocked.flags.length > 0 && <span className="font-semibold"> · {r.clocked.flags.join(", ")}</span>}
                  </p>
                )}
                {r.confirmed ? (
                  <p className="text-sm">
                    <span className="font-semibold">Confirmed:</span> {r.confirmed.times}
                    {r.confirmed.breakMinutes ? `, ${r.confirmed.breakMinutes} min break` : ""}
                    {r.sleepIn ? ` · woken to work for ${r.confirmed.awakeMinutes} min` : ` · ${r.confirmed.hours}`}
                    {r.confirmed.differs && " (differs from rota)"}
                    {r.confirmed.note && ` · ${r.confirmed.note}`}
                  </p>
                ) : (
                  <p className="text-sm font-semibold">Hours not confirmed yet</p>
                )}
              </div>
              <div className="flex gap-2">
                {r.confirmed ? (
                  <form action={undoConfirmation}>
                    <input type="hidden" name="entryId" value={r.confirmed.entryId} />
                    <button type="submit" className={small}>Undo</button>
                  </form>
                ) : (
                  <>
                    {r.clocked?.complete && (
                      <form action={useClocked}>
                        <input type="hidden" name="shiftId" value={r.shiftId} />
                        <button type="submit" disabled={usingClocked} className={small}>Confirm clocked hours</button>
                      </form>
                    )}
                    <form action={confirm}>
                      <input type="hidden" name="shiftId" value={r.shiftId} />
                      <button type="submit" disabled={confirming} className={small}>Confirm as rostered</button>
                    </form>
                  </>
                )}
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">
                {r.sleepIn ? (r.confirmed ? "Change hours or time woken" : "Enter time woken or different hours") : r.confirmed ? "Change hours" : "Enter different hours"}
              </summary>
              <form action={save} className="mt-3 flex flex-col gap-3">
                <input type="hidden" name="shiftId" value={r.shiftId} />
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Started</span>
                    <input name="start" type="time" required defaultValue={r.confirmed?.start ?? r.defaults.start} className={input} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Finished</span>
                    <input name="end" type="time" required defaultValue={r.confirmed?.end ?? r.defaults.end} className={input} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Unpaid break (minutes)</span>
                    <input name="breakMinutes" type="number" min={0} max={240} defaultValue={r.confirmed?.breakMinutes ?? r.defaults.breakMinutes} className={input} />
                  </label>
                </div>
                {r.sleepIn && (
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Time woken to work (minutes)</span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Paid at their hourly rate, on top of the sleep-in payment.</span>
                    <input name="awakeMinutes" type="number" min={0} max={1440} defaultValue={r.confirmed?.awakeMinutes ?? 0} className={`${input} w-32`} />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Reason for the change (optional)</span>
                  <input name="note" defaultValue={r.confirmed?.note ?? ""} className={input} />
                </label>
                <button type="submit" disabled={saving} className={`${small} self-start`}>
                  {saving ? "Saving…" : "Save hours"}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** items: each kind of pay with VicisRota's name for it and the business's own name, if it set one. */
export function PayItemNamesForm({ items }: { items: { item: string; standard: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setPayItemNames, {});
  return (
    <form action={action} className="mt-3 flex max-w-xl flex-col gap-3">
      <Message state={state} />
      {items.map((i) => (
        <label key={i.item} className="flex flex-col gap-1">
          <span className="font-medium">{i.standard}</span>
          <input name={i.item} defaultValue={i.name} placeholder={i.standard} maxLength={60} className={input} />
        </label>
      ))}
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        {pending ? "Saving…" : "Save pay item names"}
      </button>
    </form>
  );
}

export function SleepInPayForm({ pence }: { pence: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setSleepInPay, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Payment for each sleep-in (£)</span>
        <span className="flex flex-wrap gap-2">
          <input name="sleepInPounds" inputMode="decimal" defaultValue={pence === null ? "" : (pence / 100).toFixed(2)} placeholder="For example 60.00" className={`${input} w-40`} />
          <button type="submit" disabled={pending} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
            {pending ? "Saving…" : "Save"}
          </button>
        </span>
      </label>
    </form>
  );
}

export function SendToXeroForm({ from, to, tenantName }: { from: string; to: string; tenantName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendToXero, {});
  return (
    <form action={action} className="mt-3 flex flex-col items-start gap-3">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-400 p-3">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="rounded-lg border border-green-600 p-3">
          {state.ok}
        </p>
      )}
      <button type="submit" disabled={pending} className="rounded-lg border-2 border-brand px-4 py-2 font-medium text-heading disabled:opacity-60">
        {pending ? "Sending…" : `Send these hours to Xero (${tenantName})`}
      </button>
    </form>
  );
}
