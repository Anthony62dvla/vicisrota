"use client";

import { useActionState } from "react";
import { checkIn, saveWellbeingSettings, type FormState } from "./actions";

export function WellbeingSettingsForm({ on, after, share }: { on: boolean; after: "every" | "hard"; share: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWellbeingSettings, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex items-start gap-2">
        <input type="checkbox" name="on" defaultChecked={on} className="mt-1" />
        <span>Ask me how my shift was</span>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">After which shifts</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="after" value="hard" defaultChecked={after === "hard"} /> Long shifts (10 hours or more) and nights
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="after" value="every" defaultChecked={after === "every"} /> Every shift
        </label>
      </fieldset>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="share" defaultChecked={share} className="mt-1" />
        <span>
          Let my managers see my answers
          <span className="block text-sm text-muted">Off means only you see them. Asking for a chat always reaches a manager, without your answer or note.</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        Save
      </button>
    </form>
  );
}

export function CheckInForm({ shiftId, answers, noteMax }: { shiftId: string; answers: readonly { value: number; label: string }[]; noteMax: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(checkIn, {});
  const v = state.values;
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="shiftId" value={shiftId} />
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <fieldset>
        <legend className="font-medium">How was it?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {answers.map((a) => (
            <label key={a.value} className="flex items-center gap-2 rounded-lg border px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="radio" name="answer" value={a.value} defaultChecked={v?.answer === String(a.value)} /> {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Anything you want to note (optional)</span>
        <textarea name="note" rows={3} maxLength={noteMax} defaultValue={v?.note ?? ""} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="wantsChat" defaultChecked={v?.wantsChat === "on"} className="mt-1" />
        <span>I would like a chat with my manager</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
          Save
        </button>
        <button type="submit" name="skip" value="1" disabled={pending} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
          Skip this one
        </button>
      </div>
    </form>
  );
}
