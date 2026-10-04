"use client";

import { useActionState, useState, useTransition } from "react";
import { askToPickUp, clock, loneCheckIn, reportSick, requestTimeOff, saveTextSettings, setClockPin, type FormState } from "./actions";

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

/** The phone's position, or null if the person says no or it cannot be found within 10 seconds. */
const currentPosition = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  });

/** Only the buttons that make sense right now, large enough to tap easily. */
export function ClockButtons({ shiftId, actions, askLocation }: { shiftId: string; actions: (keyof typeof CLOCK_LABEL)[]; askLocation: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(clock, {});
  const [locating, setLocating] = useState(false);
  const [, startTransition] = useTransition();
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    if (askLocation) {
      setLocating(true);
      const position = await currentPosition();
      setLocating(false);
      if (position) {
        data.set("latitude", String(position.coords.latitude));
        data.set("longitude", String(position.coords.longitude));
        data.set("accuracy", String(position.coords.accuracy));
      }
    }
    startTransition(() => action(data));
  };
  const busy = pending || locating;
  return (
    <div className="mt-3 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      {locating && <p role="status">Checking you are at work…</p>}
      {actions.length > 0 && (
        <form onSubmit={onSubmit} className="flex flex-wrap gap-3">
          <input type="hidden" name="shiftId" value={shiftId} />
          {actions.map((k, i) => (
            <button
              key={k}
              type="submit"
              name="kind"
              value={k}
              disabled={busy}
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

export function PinForm({ hasPin }: { hasPin: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setClockPin, {});
  const field = "w-32 rounded-lg border border-zinc-400 px-3 py-2 text-base tracking-widest";
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <p>{hasPin ? "You have a PIN. You can change it here." : "Choose 4 to 6 numbers that only you know."}</p>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{hasPin ? "New PIN" : "PIN"}</span>
          <input name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} required className={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Type it again</span>
          <input name="confirm" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} required className={field} />
        </label>
      </div>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">Save PIN</button>
    </form>
  );
}

export function TextSettingsForm({ mobile, textChanges }: { mobile: string | null; textChanges: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveTextSettings, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-2 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your mobile number</span>
        <input name="mobile" type="tel" autoComplete="tel" defaultValue={v ? v.mobile : (mobile ?? "")} placeholder="07700 900123" className={`${input} max-w-xs`} />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="textChanges" defaultChecked={v ? v.textChanges === "on" : textChanges} className="mt-1" />
        <span>
          Text me when my rota changes
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">
            When shifts are published, cancelled or swapped. Nothing else, and you can turn it off here at any time.
          </span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">Save</button>
    </form>
  );
}

export function ReportSickForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(reportSick, {});
  if (state.ok) return <p role="status" className="mt-3 rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return (
    <form key={JSON.stringify(state.values ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Last day you expect to be off (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Leave empty for just today. You do not have to give a reason.</span>
        <input name="endsOn" type="date" defaultValue={state.values?.endsOn ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Sending…" : "Tell my manager I am off sick"}
      </button>
    </form>
  );
}
