"use client";

import { useActionState } from "react";
import { saveChecklist, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function ChecklistForm({ roles, places }: { roles: { id: string; name: string }[]; places: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveChecklist, {});
  const v = state.values;
  return (
    <form key={state.ok ?? JSON.stringify(v ?? {})} action={action} className="mt-2 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Name</span>
        <input name="name" defaultValue={v?.name ?? ""} placeholder="For example, Opening checks" className={`${input} max-w-sm`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Tasks, one per line</span>
        <span className="text-sm text-muted">Short and clear works best, for example &ldquo;Check the fridge is below 5°C&rdquo;.</span>
        <textarea name="items" rows={6} defaultValue={v?.items ?? ""} className={input} />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">For which role</span>
          <select name="roleId" defaultValue={v?.roleId ?? ""} className={input}>
            <option value="">Any role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">At which workplace</span>
          <select name="locationId" defaultValue={v?.locationId ?? ""} className={input}>
            <option value="">Any workplace</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        Save checklist
      </button>
    </form>
  );
}
