"use client";

import { useActionState } from "react";
import { apply, type ApplyState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

export function ApplyForm({ organisationId, postId, businessName, keepDays }: { organisationId: string; postId: string; businessName: string; keepDays: number }) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(apply, {});
  if (state.ok) return <p role="status" className="mt-4 rounded-lg border border-green-600 p-4 text-lg">{state.ok} {businessName} will be in touch.</p>;
  const v = state.values;
  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <input type="hidden" name="organisationId" value={organisationId} />
      <input type="hidden" name="postId" value={postId} />
      <div aria-hidden className="hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>}
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your name</span>
        <input name="name" autoComplete="name" defaultValue={v?.name ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Email</span>
        <input name="email" type="email" autoComplete="email" defaultValue={v?.email ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Phone</span>
        <span className="text-sm text-muted">Give an email, a phone number or both.</span>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={v?.phone ?? ""} className={input} />
      </label>
      <fieldset>
        <legend className="font-medium">How would you like them to contact you?</legend>
        <div className="mt-1 flex flex-wrap gap-4">
          {[
            ["email", "Email"],
            ["phone", "Phone call"],
            ["text", "Text message"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="contactBy" value={value} defaultChecked={v?.contactBy === value} /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="font-medium">About you</span>
        <span className="text-sm text-muted">
          You do not need a CV. Tell them, in your own words, what you would bring and any experience you have. Paid, unpaid and life experience
          all count.
        </span>
        <textarea name="about" rows={6} defaultValue={v?.about ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Anything that would help you at an interview (optional)</span>
        <span className="text-sm text-muted">
          For example, the questions in advance, a quiet room, a video call instead, extra time, or bringing someone with you. Asking will not
          count against you.
        </span>
        <textarea name="adjustments" rows={3} defaultValue={v?.adjustments ?? ""} className={input} />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="consent" className="mt-1" />
        <span>
          {businessName} can keep my application to consider me for this job. It is deleted after {Math.round(keepDays / 30)} months unless I
          am taken on.
        </span>
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-5 py-2.5 font-medium text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
