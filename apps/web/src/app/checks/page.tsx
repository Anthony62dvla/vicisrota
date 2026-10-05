import Link from "next/link";
import type { DueItem } from "@vicisrota/compliance";
import { requireManager } from "@/lib/business";
import { checksDueSummary, loadChecksDue } from "@/lib/checks-due";
import { todayInUk } from "@/lib/rota";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** Where on the person's page each kind of check is recorded. */
const ANCHOR: Record<DueItem["kind"], string> = {
  right_to_work: "right-to-work",
  dbs: "dbs",
  training: "training",
  supervision: "supervision",
  appraisal: "supervision",
};

const GROUPS: { state: DueItem["state"]; title: string; note: string }[] = [
  { state: "missing", title: "Not recorded", note: "The law needs these before the person works. They cannot go on a published rota until each is recorded." },
  { state: "overdue", title: "Overdue", note: "The date has passed. Record the new check or renewal on the person's page." },
  { state: "soon", title: "Due in the next 30 days", note: "Book these in now so nothing runs out." },
  { state: "later", title: "Coming up later", note: "Everything else with a date, so you can plan ahead." },
];

const when = (i: DueItem, today: string) => {
  if (!i.dueOn) return "Not recorded";
  if (i.state === "overdue") return `${i.kind === "training" ? "Ran out" : "Was due"} ${ukDate(i.dueOn)}`;
  if (i.dueOn === today) return "Due today";
  return `${i.kind === "training" ? "Runs out" : "Due"} ${ukDate(i.dueOn)}`;
};

export default async function ChecksDuePage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const items = await loadChecksDue(organisationId, today);
  const summary = checksDueSummary(items);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Checks due</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Right to work, DBS, licences such as an SIA licence, training and supervisions for everyone in one place. Managers get a reminder once a week
        while anything is due. To add or renew a check, open the person.
      </p>
      <p role="status" className={`mt-4 rounded-lg border-l-4 p-3 ${summary?.urgent ? "border-warn bg-warn-soft" : "border-brand bg-brand-soft"}`}>
        {summary ? summary.text : "Nothing is overdue or due in the next 30 days."}
      </p>

      {GROUPS.map(({ state, title, note }) => {
        const rows = items.filter((i) => i.state === state);
        if (!rows.length) return null;
        const list = (
          <>
            <p className="mt-1 text-sm text-muted">{note}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {rows.map((i) => (
                <li
                  key={`${i.workerId}:${i.kind}:${i.what}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-line bg-surface p-3"
                >
                  <span>
                    <span className="font-medium">{i.workerName}</span>
                    <span className="text-muted"> · </span>
                    {i.what}
                  </span>
                  <span className="flex items-center gap-4">
                    <span className={state === "missing" || state === "overdue" ? "font-semibold text-heading" : "text-muted"}>{when(i, today)}</span>
                    <Link href={`/staff/${i.workerId}#${ANCHOR[i.kind]}`} className="font-medium text-brand underline">
                      {state === "missing" ? "Record" : "Update"}
                      <span className="sr-only">
                        {" "}
                        {i.what} for {i.workerName}
                      </span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </>
        );
        return state === "later" ? (
          <details key={state} className="mt-8">
            <summary className="cursor-pointer text-lg font-semibold">
              {title} ({rows.length})
            </summary>
            {list}
          </details>
        ) : (
          <section key={state} aria-labelledby={`${state}-heading`} className="mt-8">
            <h2 id={`${state}-heading`} className="text-lg font-semibold">
              {title} ({rows.length})
            </h2>
            {list}
          </section>
        );
      })}

      {items.length === 0 && <p className="mt-6">No dated checks yet. Record right to work, DBS and training on each person&apos;s page.</p>}
    </main>
  );
}
