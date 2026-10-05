"use client";

import { useActionState } from "react";
import { CONCERN_CATEGORIES, type FormState } from "@/lib/concern-labels";
import { en, type Messages } from "@/lib/i18n/en";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

/** One calm form for staff and managers. Only "what happened" is required. */
export function ConcernForm({
  action: raise,
  clients,
  allowAnonymous,
  t = en.concernForm,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  clients: { id: string; name: string }[];
  allowAnonymous: boolean;
  t?: Messages["concernForm"];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(raise, {});
  const v = state.values ?? {};
  return (
    <form key={JSON.stringify(v)} action={action} className="mt-4 flex max-w-xl flex-col gap-5">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">{t.about}</legend>
        {CONCERN_CATEGORIES.map((c) => (
          <label key={c} className="flex items-center gap-2">
            <input type="radio" name="category" value={c} required defaultChecked={v.category === c} /> {t.categories[c]}
          </label>
        ))}
      </fieldset>
      {clients.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="font-medium">{t.client}</span>
          <select name="clientId" defaultValue={v.clientId ?? ""} className={input}>
            <option value="">{t.noClient}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.who}</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{t.whoHint}</span>
        <input name="aboutPerson" defaultValue={v.aboutPerson} maxLength={200} autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.what}</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {t.whatHint}
        </span>
        <textarea name="details" defaultValue={v.details} rows={6} required maxLength={10000} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t.when}</span>
        <input name="happenedOn" type="date" defaultValue={v.happenedOn} className={input} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="immediateDanger" defaultChecked={v.immediateDanger === "on"} /> {t.danger}
      </label>
      {allowAnonymous && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="anonymous" defaultChecked={v.anonymous === "on"} className="mt-1" />
          <span>
            {t.anonymous}
            <span className="block text-sm text-zinc-600 dark:text-zinc-400">
              {t.anonymousHint}
            </span>
          </span>
        </label>
      )}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? t.sending : t.send}
      </button>
    </form>
  );
}
