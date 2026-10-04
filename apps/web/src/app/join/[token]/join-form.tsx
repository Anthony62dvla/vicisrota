"use client";

import { useActionState } from "react";
import { acceptInvitation, type JoinState } from "./actions";

export function JoinForm({ token, businessName }: { token: string; businessName: string }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(acceptInvitation, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Joining…" : `Join ${businessName}`}
      </button>
    </form>
  );
}
