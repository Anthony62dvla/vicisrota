"use client";

import { useActionState } from "react";
import { addTraining, saveCourseLink, type FormState } from "./actions";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";

function Message({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="rounded-lg border border-red-400 p-3">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-lg border border-green-600 p-3">{state.ok}</p>;
  return null;
}

export function CourseLinkForm({ id, name, courseUrl }: { id: string; name: string; courseUrl: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCourseLink, {});
  const value = state.values?.courseUrl ?? courseUrl ?? "";
  return (
    <form key={value} action={action} className="mt-2 flex flex-col gap-2">
      <Message state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Where staff can do this course</span>
        <span className="flex flex-wrap gap-2">
          <input name="courseUrl" type="text" inputMode="url" autoComplete="url" maxLength={300} defaultValue={value} placeholder="For example www.example.co.uk/course" aria-label={`Course link for ${name}`} className={`${input} min-w-0 flex-1`} />
          <button type="submit" disabled={pending} className="rounded-lg border border-zinc-500 px-3 py-2 disabled:opacity-60">
            {pending ? "Saving…" : "Save link"}
          </button>
        </span>
      </label>
    </form>
  );
}

export function AddTrainingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addTraining, {});
  const v = state.values;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="mt-3 flex max-w-md flex-col gap-4">
      <Message state={state} />
      <label className="flex flex-col gap-1">
        <span className="font-medium">Training name</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">For example Food hygiene (level 2), First aid or Manual handling.</span>
        <input name="name" maxLength={80} defaultValue={v?.name ?? ""} className={input} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Course link (optional)</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">A web page where staff can do or renew it.</span>
        <input name="courseUrl" type="text" inputMode="url" maxLength={300} defaultValue={v?.courseUrl ?? ""} className={input} />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
        {pending ? "Adding…" : "Add training"}
      </button>
    </form>
  );
}
