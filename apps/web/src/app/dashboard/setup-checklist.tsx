import { setupFinished, type SetupStep } from "@vicisrota/compliance";
import Link from "next/link";

/**
 * Guided setup for a new business. Steps tick themselves off as things are recorded.
 * The next step to do is the only one with a button, so there is always one clear thing to do next.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const required = steps.filter((s) => !s.optional);
  const optional = steps.filter((s) => s.optional);
  const doneCount = required.filter((s) => s.done).length;

  if (setupFinished(steps)) {
    const left = optional.filter((s) => !s.done);
    if (!left.length) return null;
    return (
      <details className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-medium">
          Setup done. {left.length} optional {left.length === 1 ? "step" : "steps"} you may want
        </summary>
        <ol className="mt-3 space-y-3">
          {left.map((s) => <Step key={s.id} step={s} next={false} />)}
        </ol>
      </details>
    );
  }

  const next = required.find((s) => !s.done)!;
  return (
    <section aria-labelledby="setup-heading" className="mt-6 rounded-lg border-2 border-zinc-900 p-4 dark:border-zinc-100">
      <h2 id="setup-heading" className="text-lg font-semibold">Get ready for your first rota</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {doneCount} of {required.length} steps done. Each step ticks itself off when you finish it.
      </p>
      <ol className="mt-4 space-y-3">
        {required.map((s) => <Step key={s.id} step={s} next={s === next} />)}
      </ol>
      <h3 className="mt-6 font-medium">Optional</h3>
      <ol className="mt-2 space-y-3">
        {optional.map((s) => <Step key={s.id} step={s} next={false} />)}
      </ol>
    </section>
  );
}

function Step({ step, next }: { step: SetupStep; next: boolean }) {
  return (
    <li className={`flex gap-3 rounded-lg p-3 ${next ? "bg-zinc-100 dark:bg-zinc-800" : ""}`} aria-current={next ? "step" : undefined}>
      <span aria-hidden className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${step.done ? "border-green-700 bg-green-700 text-white" : "border-zinc-500"}`}>
        {step.done ? "✓" : ""}
      </span>
      <div className="flex-1">
        <p className={`font-medium ${step.done ? "text-zinc-600 dark:text-zinc-400" : ""}`}>
          <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
          {step.done ? step.title : <Link href={step.href} className="underline">{step.title}</Link>}
          {step.progress && <span className="ml-2 text-sm font-normal text-zinc-600 dark:text-zinc-400">({step.progress})</span>}
        </p>
        {!step.done && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{step.why}</p>}
        {next && (
          <Link href={step.href} className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
            Do this next
          </Link>
        )}
      </div>
    </li>
  );
}
