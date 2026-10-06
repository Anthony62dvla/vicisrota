import { PrintButton } from "../workplaces/poster/print-button";

const ukDate = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

/** A written statement, section by section, exactly as it was given. Prints cleanly on its own. */
export function StatementView({ sections, issuedAt, readAt }: { sections: { heading: string; text: string }[]; issuedAt: Date; readAt: Date | null }) {
  return (
    <article className="mt-4">
      <h1 className="text-2xl font-semibold">Written statement of particulars</h1>
      <p className="mt-1 text-sm text-muted">
        Given {ukDate(issuedAt)}. {readAt ? `Read ${ukDate(readAt)}.` : "Not read yet."}
      </p>
      <dl className="mt-6 flex flex-col gap-5">
        {sections.map((s) => (
          <div key={s.heading} className="break-inside-avoid">
            <dt className="font-semibold">{s.heading}</dt>
            <dd className="mt-1 whitespace-pre-line">{s.text}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8">
        <PrintButton label="Print or save as PDF" />
      </div>
    </article>
  );
}
