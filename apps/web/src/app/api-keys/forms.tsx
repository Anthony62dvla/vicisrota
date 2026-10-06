"use client";

import { useActionState } from "react";
import { createApiKey, type KeyState } from "./actions";

export function CreateKeyForm() {
  const [state, action, pending] = useActionState<KeyState, FormData>(createApiKey, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-400 p-3">
          {state.error}
        </p>
      )}
      {state.key && (
        <div role="status" className="rounded-lg border-2 border-amber-500 p-4">
          <p className="font-medium">Your new key for {state.name}</p>
          <p className="mt-1 text-sm">Copy it now and keep it somewhere safe, like a password. It will not be shown again.</p>
          <input readOnly value={state.key} aria-label="New API key" onFocus={(e) => e.target.select()} className="mt-2 w-full rounded-lg border border-zinc-400 px-3 py-2 font-mono text-sm" />
        </div>
      )}
      <label className="flex max-w-sm flex-col gap-1">
        <span className="font-medium">Name for the key</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">For example, the software that will use it.</span>
        <input name="name" maxLength={80} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Creating…" : "Create key"}
      </button>
    </form>
  );
}
