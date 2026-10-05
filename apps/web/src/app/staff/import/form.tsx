"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importStaff, type ImportState } from "./actions";

const button = "rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-60";
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStaff, {});
  const c = state.check;

  if (state.done) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <p role="status" className="rounded-lg border-l-4 border-ok bg-ok-soft p-3">
          {state.done}
        </p>
        <p>
          <Link href="/staff" className="font-medium text-brand underline">
            Go to Staff
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      {state.error && (
        <p role="alert" className="rounded-lg border-l-4 border-warn bg-warn-soft p-3">
          {state.error}
        </p>
      )}

      <form action={action} className="flex max-w-md flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-medium">{c ? "Upload a different file" : "Your CSV file"}</span>
          <input name="file" type="file" accept=".csv,text/csv" required className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Checking…" : "Check the file"}
        </button>
        <p className="text-sm text-muted">Nothing is saved yet. You will see who will be added first.</p>
      </form>

      {c && (
        <section aria-labelledby="preview-heading" className="flex flex-col gap-5">
          <h2 id="preview-heading" className="text-lg font-semibold">
            Ready to add: {c.people.length} {c.people.length === 1 ? "person" : "people"}
          </h2>

          {c.problems.length > 0 && (
            <div className="rounded-lg border-l-4 border-warn bg-warn-soft p-3">
              <p className="font-medium">
                {c.problems.length} {c.problems.length === 1 ? "row needs" : "rows need"} fixing and will be left out. Fix them in the spreadsheet and upload
                it again, or add them later.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {c.problems.map((p) => (
                  <li key={p.line}>
                    Row {p.line}, {p.name}: {p.reasons.join("; ")}.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.duplicates.length > 0 && (
            <p className="rounded-lg border-l-4 border-brand bg-brand-soft p-3">
              Already here, so left out: {c.duplicates.map((d) => `${d.name} (row ${d.line})`).join(", ")}.
            </p>
          )}

          {c.warnings.length > 0 && (
            <div className="rounded-lg border-l-4 border-warn bg-warn-soft p-3">
              <p className="font-medium">Worth a look. These people will still be added:</p>
              <ul className="mt-2 flex flex-col gap-1">
                {c.warnings.map((w) => (
                  <li key={w.line}>
                    {w.name}: {w.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.people.length > 0 && (
            <>
              <ul className="flex flex-col gap-2">
                {c.people.map((p) => (
                  <li key={p.line} className="flex flex-wrap justify-between gap-x-4 rounded-lg border border-line bg-surface p-3">
                    <span className="font-medium">{p.fullName}</span>
                    <span className="text-muted">
                      {pounds(p.hourlyPence)} an hour{p.roles.length ? ` · ${p.roles.join(", ")}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <form action={action}>
                <input type="hidden" name="confirm" value="yes" />
                <input type="hidden" name="csv" value={state.csv} />
                <button type="submit" disabled={pending} className={button}>
                  {pending ? "Adding…" : `Add ${c.people.length} ${c.people.length === 1 ? "person" : "people"}`}
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
