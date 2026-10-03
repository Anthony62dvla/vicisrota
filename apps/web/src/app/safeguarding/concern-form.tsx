"use client";

import { useActionState } from "react";
import { CONCERN_CATEGORIES, CONCERN_LABEL, type FormState } from "@/lib/concern-labels";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

/** One calm form for staff and managers. Only "what happened" is required. */
export function ConcernForm({
  action: raise,
  clients,
  allowAnonymous,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  clients: { id: string; name: string }[];
  allowAnonymous: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(raise, {});
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} className="mt-4 flex max-w-xl flex-col gap-5">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">What is it about?</legend>
        {CONCERN_CATEGORIES.map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input type="radio" name="category" value={c} required defaultChecked={v.category === c} /> {CONCERN_LABEL[c]}
          </label>
        ))}
      </fieldset>
      {clients.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">Is it about someone you support? (optional)</span>
          <select name="clientId" defaultValue={v.clientId ?? ""} className={input}>
            <option value="">No, or I would rather not say</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Who is it about? (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">A name or a description is fine.</span>
        <input name="aboutPerson" defaultValue={v.aboutPerson} maxLength={200} autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">What happened, or what did you notice?</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Write it in your own words. Say what you saw or heard. You do not need to be sure, and you do not need to investigate.
        </span>
        <textarea name="details" defaultValue={v.details} rows={6} required maxLength={10000} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">When did it happen? (optional)</span>
        <input name="happenedOn" type="date" defaultValue={v.happenedOn} className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="immediateDanger" defaultChecked={v.immediateDanger === "on"} /> Someone may be in danger right now
      </label>
      {allowAnonymous && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="anonymous" defaultChecked={v.anonymous === "on"} className="mt-1" />
          <span>
            Do not record my name
            <span className="block text-sm text-zinc-600 dark:text-zinc-400">
              Managers will not know it was you. They also cannot ask you questions or tell you what happened.
            </span>
          </span>
        </label>
      )}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Sending…" : "Send concern"}
      </button>
    </form>
  );
}
