"use client";

import { useActionState } from "react";
import type { Messages } from "@/lib/i18n";
import { checkIn, saveWellbeingSettings, type FormState } from "./actions";

type Words = Messages["wellbeingForm"];

export function WellbeingSettingsForm({ on, after, share, t }: { on: boolean; after: "every" | "hard"; share: boolean; t: Words }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWellbeingSettings, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="on" defaultChecked={on} className="mt-1" />
        <span>{t.askMe}</span>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">{t.afterWhich}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="after" value="hard" defaultChecked={after === "hard"} /> {t.hardShifts}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="after" value="every" defaultChecked={after === "every"} /> {t.every}
        </label>
      </fieldset>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="share" defaultChecked={share} className="mt-1" />
        <span>
          {t.share}
          <span className="block text-sm text-muted">{t.shareHint}</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        {t.save}
      </button>
    </form>
  );
}

export function CheckInForm({ shiftId, answers, noteMax, t }: { shiftId: string; answers: readonly { value: number; label: string }[]; noteMax: number; t: Words }) {
  const [state, action, pending] = useActionState<FormState, FormData>(checkIn, {});
  const v = state.values;
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="shiftId" value={shiftId} />
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <fieldset>
        <legend className="font-medium">{t.howWasIt}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {answers.map((a) => (
            <label key={a.value} className="flex items-center gap-2 rounded-lg border px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="answer" value={a.value} defaultChecked={v?.answer === String(a.value)} /> {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.note}</span>
        <textarea name="note" rows={3} maxLength={noteMax} defaultValue={v?.note ?? ""} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="wantsChat" defaultChecked={v?.wantsChat === "on"} className="mt-1" />
        <span>{t.chat}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
          {t.save}
        </button>
        <button type="submit" name="skip" value="1" disabled={pending} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
          {t.skip}
        </button>
      </div>
    </form>
  );
}
