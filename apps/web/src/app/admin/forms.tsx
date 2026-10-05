"use client";

import { PACKS } from "@/lib/sector-packs";
import { useActionState } from "react";
import { approveCharity, newOwnerLink, onboardBusiness, type OnboardState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

function Result({ state }: { state: OnboardState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (!state.ok) return null;
  return (
    <div role="status" className="rounded-lg border border-green-600 p-3">
      <p>{state.ok}</p>
      {state.link && (
        <label className="mt-2 flex flex-col gap-1">
          <span className="font-medium">Owner link</span>
          <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} className={`${input} font-mono text-sm`} />
        </label>
      )}
    </div>
  );
}

export function OnboardForm() {
  const [state, action, pending] = useActionState<OnboardState, FormData>(onboardBusiness, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Result state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Business name</span>
        <input name="name" maxLength={120} defaultValue={v?.name ?? ""} className={input} />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">Type of business</legend>
        {PACKS.map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <input type="radio" name="kind" value={p.id} defaultChecked={v?.kind === p.id} />
            {p.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Owner&apos;s name</span>
        <input name="ownerName" defaultValue={v?.ownerName ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Owner&apos;s email</span>
        <input name="email" type="email" defaultValue={v?.email ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className={button}>{pending ? "Setting up…" : "Set up business"}</button>
    </form>
  );
}

export function NewOwnerLinkButton({ organisationId }: { organisationId: string }) {
  const [state, action, pending] = useActionState<OnboardState, FormData>(newOwnerLink, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <Result state={state} />
      <input type="hidden" name="organisationId" value={organisationId} />
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-500 px-3 py-1 text-sm disabled:opacity-60">
        {pending ? "Making link…" : "Make a new owner link"}
      </button>
    </form>
  );
}

export function ApproveCharityButton({ organisationId }: { organisationId: string }) {
  const [state, action, pending] = useActionState<OnboardState, FormData>(approveCharity, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <Result state={state} />
      <input type="hidden" name="organisationId" value={organisationId} />
      <button type="submit" disabled={pending} className={button}>Number checked: turn on charity price</button>
    </form>
  );
}
