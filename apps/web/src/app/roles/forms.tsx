"use client";

import { useActionState } from "react";
import { ROLE_BADGE, ROLE_COLOUR_LABEL, ROLE_COLOURS, type RoleColour } from "@/lib/role-labels";
import type { SuggestedGroup } from "@/lib/role-suggestions";
import { addRole, addSuggestedRoles, saveWorkerRoles, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function AddRoleForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addRole, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Role name</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">For example Chef, Bar, Senior carer or Shift lead.</span>
        <input name="name" maxLength={40} defaultValue={v?.name ?? ""} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Colour on the rota</legend>
        <div className="flex flex-wrap gap-2">
          {ROLE_COLOURS.map((c, i) => (
            <label key={c} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${ROLE_BADGE[c]}`}>
              <input type="radio" name="colour" value={c} defaultChecked={v?.colour ? v.colour === c : i === 0} />
              {ROLE_COLOUR_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Adding…" : "Add role"}
      </button>
    </form>
  );
}

export function WorkerRolesForm({ workerId, roles, held }: { workerId: string; roles: { id: string; name: string; colour: RoleColour }[]; held: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveWorkerRoles, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <Message state={state} />
      <input type="hidden" name="workerId" value={workerId} />
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <label key={r.id} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${ROLE_BADGE[r.colour]}`}>
            <input type="checkbox" name="roleId" value={r.id} defaultChecked={held.includes(r.id)} />
            {r.name}
          </label>
        ))}
      </div>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-500 px-3 py-1 disabled:opacity-60">
        {pending ? "Saving…" : "Save roles"}
      </button>
    </form>
  );
}

export function SuggestedRolesForm({ groups, have }: { groups: SuggestedGroup[]; have: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addSuggestedRoles, {});
  const owned = new Set(have.map((n) => n.toLowerCase()));
  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <Message state={state} />
      {groups.map((g, i) => (
        <details key={g.id} open={i === 0} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
          <summary className="cursor-pointer font-medium">{g.title}</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.roles.map(([name, colour]) =>
              owned.has(name.toLowerCase()) ? (
                <span key={name} className={`rounded-full border border-dashed px-3 py-1 ${ROLE_BADGE[colour]}`}>{name} (added)</span>
              ) : (
                <label key={name} className={`flex items-center gap-2 rounded-full border px-3 py-1 ${ROLE_BADGE[colour]}`}>
                  <input type="checkbox" name="role" value={name} />
                  {name}
                </label>
              ),
            )}
          </div>
        </details>
      ))}
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Adding…" : "Add ticked roles"}
      </button>
    </form>
  );
}
