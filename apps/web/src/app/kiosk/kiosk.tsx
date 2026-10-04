"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { kioskClock, type KioskState } from "./actions";

export type KioskPerson = { shiftId: string; name: string; times: string; status: string; actions: ("in" | "break_start" | "break_end" | "out")[] };

const LABEL = { in: "Clock in", break_start: "Start break", break_end: "End break", out: "Clock out" } as const;
const big = "rounded-xl px-6 py-4 text-xl font-medium disabled:opacity-60";

/** Tap your name, tap what you are doing, enter your PIN. Returns to the start on its own. */
export function Kiosk({ people }: { people: KioskPerson[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<KioskState, FormData>(kioskClock, {});
  const [chosen, setChosen] = useState<{ person: KioskPerson; kind: keyof typeof LABEL } | null>(null);
  const [pin, setPin] = useState("");
  const [dismissed, setDismissed] = useState<number | undefined>();

  // After a result, go back to the list and refresh it, so the tablet is ready for the next person.
  useEffect(() => {
    if (!state.at) return;
    const t = setTimeout(() => {
      setDismissed(state.at);
      setChosen(null);
      setPin("");
      router.refresh();
    }, state.ok ? 3000 : 6000);
    return () => clearTimeout(t);
  }, [state.at, state.ok, router]);
  // Keep the list current while nobody is using it.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  if (state.at && state.at !== dismissed && !pending) {
    return (
      <p role={state.ok ? "status" : "alert"} className={`mt-8 rounded-xl border-2 p-6 text-2xl ${state.ok ? "border-green-600" : "border-red-500"}`}>
        {state.ok ?? state.error}
      </p>
    );
  }

  if (chosen) {
    return (
      <form action={action} className="mt-8 flex max-w-sm flex-col gap-4">
        <p className="text-2xl font-semibold">
          {chosen.person.name}: {LABEL[chosen.kind]}
        </p>
        <input type="hidden" name="shiftId" value={chosen.person.shiftId} />
        <input type="hidden" name="kind" value={chosen.kind} />
        <label className="flex flex-col gap-2">
          <span className="text-lg">Enter your PIN</span>
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="rounded-xl border-2 border-zinc-400 px-4 py-3 text-center text-3xl tracking-widest"
          />
        </label>
        <div className="grid grid-cols-3 gap-3" aria-hidden="true">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k, i) =>
            k ? (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                onClick={() => setPin((p) => (k === "⌫" ? p.slice(0, -1) : (p + k).slice(0, 6)))}
                className="rounded-xl border border-zinc-400 py-4 text-2xl"
              >
                {k}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={pending || pin.length < 4} className={`${big} bg-brand text-on-brand hover:bg-brand-hover`}>
            {pending ? "Checking…" : "Done"}
          </button>
          <button type="button" onClick={() => (setChosen(null), setPin(""))} className={`${big} border border-zinc-400`}>
            Back
          </button>
        </div>
      </form>
    );
  }

  return people.length === 0 ? (
    <p className="mt-8 text-xl">Nobody is due to clock in or out right now.</p>
  ) : (
    <ul className="mt-8 flex flex-col gap-4">
      {people.map((p) => (
        <li key={p.shiftId} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
          <div>
            <p className="text-2xl font-semibold">{p.name}</p>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              {p.times} · {p.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {p.actions.map((k, i) => (
              <button
                key={k}
                type="button"
                onClick={() => setChosen({ person: p, kind: k })}
                className={`${big} ${i === 0 ? "bg-brand text-on-brand hover:bg-brand-hover" : "border border-zinc-400"}`}
              >
                {LABEL[k]}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
