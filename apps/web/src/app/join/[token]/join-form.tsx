"use client";

import { useActionState } from "react";
import { acceptInvitation, type JoinState } from "./actions";

export function JoinForm({ token, businessName }: { token: string; businessName: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Joining…" : `Join ${businessName}`}
      </button>
    </form>
  );
}
