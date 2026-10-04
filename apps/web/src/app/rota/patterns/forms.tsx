"use client";

import { MAX_FILL_WEEKS, MAX_PATTERN_WEEKS } from "@vicisrota/compliance";
import { useActionState } from "react";
import { fillRotaFromPattern, saveRotaPattern, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function SavePatternForm({ week }: { week: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRotaPattern, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name</span>
        <input name="name" defaultValue={v?.name ?? ""} placeholder="For example: Standard fortnight" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">First week</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Any day in the week. The pattern starts on its Monday.</span>
        <input name="firstWeek" type="date" defaultValue={v?.firstWeek ?? week} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">How many weeks before it repeats</span>
        <select name="weeks" defaultValue={v?.weeks ?? "1"} className={input}>
          {Array.from({ length: MAX_PATTERN_WEEKS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === 1 ? "1 week (the same every week)" : `${n} weeks (a ${n}-week rotation)`}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={button}>{pending ? "Saving…" : "Save as a pattern"}</button>
    </form>
  );
}

export function FillForm({ patternId, weeks, nextWeek }: { patternId: string; weeks: number; nextWeek: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(fillRotaFromPattern, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="patternId" value={patternId} />
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Starting the week of</span>
          <input name="fromWeek" type="date" defaultValue={v?.fromWeek ?? nextWeek} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">For</span>
          <select name="weeks" defaultValue={v?.weeks ?? "4"} className={input}>
            {Array.from({ length: MAX_FILL_WEEKS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n === 1 ? "1 week" : `${n} weeks`}</option>
            ))}
          </select>
        </label>
        {weeks > 1 && (
          <label className="flex flex-col gap-1">
            <span className="font-medium">Start with</span>
            <select name="startAtWeek" defaultValue={v?.startAtWeek ?? "1"} className={input}>
              {Array.from({ length: weeks }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Week {n} of the pattern</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <button type="submit" disabled={pending} className={button}>{pending ? "Filling…" : "Fill the rota with drafts"}</button>
    </form>
  );
}
