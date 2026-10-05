"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { createGroup, markRead, saveQuietHours, sendMessage, setGroupMembers, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
type Person = { userId: string; name: string; role: string };

const roleNote = (role: string) => (role === "worker" ? "" : " (manager)");

export function NewGroupForm({ people }: { people: Person[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createGroup, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Group name</span>
        <input name="name" defaultValue={state.values?.name ?? ""} placeholder="For example, Kitchen team" className={`${input} max-w-sm`} />
      </label>
      <fieldset>
        <legend className="font-medium">Who is in it</legend>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.userId}>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="members" value={p.userId} /> {p.name}
                {roleNote(p.role)}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        Set up group
      </button>
    </form>
  );
}

export function GroupMembersForm({ conversationId, people, members }: { conversationId: string; people: Person[]; members: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setGroupMembers, {});
  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <ul className="grid gap-1 sm:grid-cols-2">
        {people.map((p) => (
          <li key={p.userId}>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="members" value={p.userId} defaultChecked={members.includes(p.userId)} /> {p.name}
              {roleNote(p.role)}
            </label>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        Save who is in the group
      </button>
    </form>
  );
}

/** Writing a message. The box empties once it is sent; Enter makes a new line, so nothing goes by accident. */
export function MessageForm({ conversationId, max }: { conversationId: string; max: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMessage, {});
  return (
    <form key={state.sentAt ?? 0} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your message</span>
        <textarea name="body" rows={3} maxLength={max} defaultValue={state.values?.body ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

/** While a conversation is open: checks for new messages every 15 seconds and marks them read. */
export function LiveConversation({ conversationId, latest }: { conversationId: string; latest: number }) {
  const router = useRouter();
  const seen = useRef(0);
  useEffect(() => {
    if (latest > seen.current) {
      seen.current = latest;
      markRead(conversationId).catch(() => {});
    }
  }, [conversationId, latest]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}

export function QuietHoursForm({ from, to, daysOff, isStaff }: { from: string | null; to: string | null; daysOff: boolean; isStaff: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveQuietHours, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-2 flex flex-col gap-3">
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>}
      <label className="flex items-center gap-2">
        <input type="checkbox" name="quietOn" defaultChecked={v ? v.quietOn === "on" : !!(from && to)} /> Quiet hours every day
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1">
          <span>From</span>
          <input type="time" name="from" defaultValue={v ? v.from : (from ?? "21:00")} className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span>Until</span>
          <input type="time" name="to" defaultValue={v ? v.to : (to ?? "07:00")} className={input} />
        </label>
      </div>
      {isStaff && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="daysOff" defaultChecked={v ? v.daysOff === "on" : daysOff} className="mt-1" />
          <span>
            Quiet all day on my days off
            <span className="block text-sm text-zinc-600 dark:text-zinc-400">Any day you have no shift.</span>
          </span>
        </label>
      )}
      <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
        Save quiet hours
      </button>
    </form>
  );
}
