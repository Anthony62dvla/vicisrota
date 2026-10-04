import { evaluate, type Context } from "@vicisrota/compliance";
import Link from "next/link";

// A sample week used to show the compliance engine working end to end.
// Replaced by real rota data once the database lands.
const sample: Context = {
  asOf: "2026-10-05",
  workers: [
    { id: "amy", name: "Amy", dateOfBirth: "1990-05-01" },
    { id: "tom", name: "Tom", dateOfBirth: "2009-06-15" },
  ],
  shifts: [
    { id: "amy-close", workerId: "amy", start: "2026-10-05T16:00:00+01:00", end: "2026-10-05T23:30:00+01:00" },
    { id: "amy-open", workerId: "amy", start: "2026-10-06T09:00:00+01:00", end: "2026-10-06T13:00:00+01:00" },
    { id: "tom-eve", workerId: "tom", start: "2026-10-07T17:00:00+01:00", end: "2026-10-07T22:30:00+01:00" },
  ],
  payRates: [
    { workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" },
    { workerId: "tom", hourlyPence: 800, effectiveFrom: "2026-04-01" },
  ],
};

export default function Home() {
  const result = evaluate(sample);
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold">VicisRota</h1>
      <p className="mt-2">
        <Link href="/sign-in" className="underline">Sign in</Link> or <Link href="/sign-up" className="underline">create an account</Link>
      </p>
      <p className="mt-6 text-zinc-600 dark:text-zinc-400">Sample rota check, week of {result.asOf}</p>
      <p className="mt-6 font-medium">
        {result.publishable ? "This rota can be published." : "This rota cannot be published yet."}
      </p>
      <ul className="mt-4 space-y-3">
        {result.findings.map((f) => (
          <li key={`${f.ruleId}:${f.shiftIds.join(",")}`} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
            <p>{f.message}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{f.legalRef}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
