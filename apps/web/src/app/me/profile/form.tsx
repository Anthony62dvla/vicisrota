"use client";

import { useActionState } from "react";
import { CONTACT_LABEL, CONTACT_WAYS, PROFILE_MAX, PROFILE_QUESTIONS, type WorkProfile } from "@/lib/work-profile";
import { saveWorkProfile, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function WorkProfileForm({ profile }: { profile: WorkProfile }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkProfile, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-6">
      {PROFILE_QUESTIONS.map((q) => (
        <label key={q.key} className="flex flex-col gap-1">
          <span className="font-medium">{q.label}</span>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{q.hint}</span>
          <textarea name={q.key} rows={3} maxLength={PROFILE_MAX} defaultValue={profile[q.key] ?? ""} className={input} />
        </label>
      ))}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Ways I am happy to be contacted about work</legend>
        {CONTACT_WAYS.map((w) => (
          <label key={w} className="flex items-center gap-2">
            <input type="checkbox" name="contact" value={w} defaultChecked={profile.contact?.includes(w)} /> {CONTACT_LABEL[w]}
          </label>
        ))}
        <label className="mt-1 flex items-center gap-2">
          <input type="checkbox" name="avoidCalls" defaultChecked={profile.avoidCalls} /> Please only phone me if it is urgent
        </label>
      </fieldset>

      <label className="flex items-start gap-2 rounded-lg border border-brand p-3">
        <input type="checkbox" name="shared" defaultChecked={profile.shared} className="mt-1" />
        <span>
          Let my managers see this
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">
            You can change your mind at any time. It is never shown to colleagues or on the rota.
          </span>
        </span>
      </label>

      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
