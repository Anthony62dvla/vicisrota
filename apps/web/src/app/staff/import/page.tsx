import Link from "next/link";
import { STAFF_IMPORT_COLUMNS, STAFF_IMPORT_REQUIRED } from "@vicisrota/compliance";
import { requireManager } from "@/lib/business";
import { ImportForm } from "./form";

const HINTS: Record<(typeof STAFF_IMPORT_COLUMNS)[number], string> = {
  "Full name": "As it appears on payslips.",
  "Date of birth": "For example 31/12/1990. Used for minimum wage bands and under-18 rules.",
  "Hourly rate": "In pounds, for example 12.71.",
  "Rate starts on": "If empty, their start date, or today.",
  "Start date": "When they started working for you. Used for holiday.",
  "Days per week": "Their usual days. If empty, 5.",
  "Irregular hours": "yes for zero-hours or term-time work, so holiday is worked out the right way.",
  Mobile: "A UK mobile, for shift texts and alerts.",
  "Payroll ID": "Their employee number in your payroll software.",
  "Job roles": "Separate more than one with a semicolon. Each must already be on the Job roles page.",
};

export default async function ImportStaffPage() {
  await requireManager();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/staff" className="text-brand underline">
          Staff
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Add people from a spreadsheet</h1>
      <p className="mt-2 text-muted">Bring your whole team in at once. You will see who will be added, and any rows that need fixing, before anything is saved.</p>

      <ol className="mt-6 flex list-decimal flex-col gap-2 pl-6">
        <li>
          <Link href="/staff/import/template" prefetch={false} download className="font-medium text-brand underline">
            Download the template
          </Link>{" "}
          and open it in Excel, Numbers or Google Sheets.
        </li>
        <li>Put one person on each row, under the headings. You can also use your own spreadsheet if it has the same headings.</li>
        <li>Save or download it as CSV, then upload it below.</li>
      </ol>

      <details className="mt-4 rounded-lg border border-line bg-surface p-4">
        <summary className="cursor-pointer font-medium">What goes in each column</summary>
        <dl className="mt-3 flex flex-col gap-2">
          {STAFF_IMPORT_COLUMNS.map((c) => (
            <div key={c}>
              <dt className="font-medium">
                {c}
                {(STAFF_IMPORT_REQUIRED as readonly string[]).includes(c) ? " (needed)" : " (optional)"}
              </dt>
              <dd className="text-muted">{HINTS[c]}</dd>
            </div>
          ))}
        </dl>
      </details>

      <ImportForm />
    </main>
  );
}
