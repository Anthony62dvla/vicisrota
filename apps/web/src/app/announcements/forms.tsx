"use client";

import { useActionState } from "react";
import { postAnnouncement, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function AnnouncementForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(postAnnouncement, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-xl flex-col gap-4">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Title</span>
        <input name="title" maxLength={120} defaultValue={v?.title ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Message</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Plain words and short sentences work best for everyone. It cannot be edited once posted.</span>
        <textarea name="body" rows={6} maxLength={5000} defaultValue={v?.body ?? ""} className={input} />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="needsConfirmation" defaultChecked={v?.needsConfirmation === "on"} className="mt-1" />
        <span>
          Ask staff to confirm they have read it
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">For policy changes and safety information. You will see who has not confirmed yet.</span>
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Posting…" : "Post to all staff"}
      </button>
    </form>
  );
}
