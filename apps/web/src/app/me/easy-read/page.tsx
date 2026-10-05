import { addDays, londonDateTime, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gt, gte, inArray, lt, ne } from "drizzle-orm";
import Link from "next/link";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { spokenLength, spokenTime, timeOfDay } from "@/lib/easy-read";
import { todayInUk } from "@/lib/rota";
import { ReadAloud } from "./read-aloud";

const WEEKS_AHEAD = 2;
const MINUTE = 60_000;

type Picture = "morning" | "day" | "evening" | "night" | "finish" | "break" | "place" | "role" | "people" | "note";

/** Simple pictures that sit next to each sentence. The sentence always says the same thing in words. */
const PICTURES: Record<Picture, string> = {
  morning: "M3 18h18M7 18a5 5 0 0 1 10 0M12 4v3M5.6 9.6l1.4 1.4M18.4 9.6 17 11M2 14h2M20 14h2",
  day: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8",
  evening: "M3 18h18M7 18a5 5 0 0 1 10 0M12 9V4M9.5 6.5 12 4l2.5 2.5",
  night: "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z",
  finish: "M5 21V4M5 4h11l-2 4 2 4H5",
  break: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3",
  place: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  role: "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7",
  people: "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2.1.8 3.5 2.9 3.5 5.7",
  note: "M5 4h14v12H9l-4 4V4zM9 9h6M9 12h4",
};

function Line({ picture, children }: { picture: Picture; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-9 w-9 text-heading" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={PICTURES[picture]} />
        </svg>
      </span>
      <span className="pt-3 text-xl leading-snug">{children}</span>
    </li>
  );
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const listWords = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * Easy Read rota: the person's next two weeks, one shift per card, in short sentences with a picture each
 * and a button that reads the card aloud. The same information as My shifts, said more simply.
 */
export default async function EasyReadPage() {
  const { organisationId, businessName, worker } = await requireStaff();
  const today = todayInUk();
  const from = new Date(londonDateTime(today, "00:00"));
  const to = new Date(londonDateTime(addDays(today, WEEKS_AHEAD * 7), "00:00"));

  const data = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select({ shift: schema.shift, place: schema.location.name, role: schema.jobRole.name, client: schema.client.name })
      .from(schema.shift)
      .leftJoin(schema.location, eq(schema.shift.locationId, schema.location.id))
      .leftJoin(schema.jobRole, eq(schema.shift.roleId, schema.jobRole.id))
      .leftJoin(schema.client, eq(schema.shift.clientId, schema.client.id))
      .where(and(eq(schema.shift.workerId, worker.id), eq(schema.shift.status, "published"), gte(schema.shift.endsAt, from), lt(schema.shift.startsAt, to)))
      .orderBy(asc(schema.shift.startsAt));
    const ids = shifts.map((s) => s.shift.id);
    return {
      shifts,
      breaks: ids.length ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)) : [],
      // First names only, as on My shifts.
      colleagues: ids.length
        ? await tx
            .select({ startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt, name: schema.worker.fullName })
            .from(schema.shift)
            .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
            .where(
              and(
                eq(schema.shift.status, "published"),
                ne(schema.shift.workerId, worker.id),
                lt(schema.shift.startsAt, shifts.at(-1)!.shift.endsAt),
                gt(schema.shift.endsAt, shifts[0]!.shift.startsAt),
              ),
            )
        : [],
    };
  });

  const cards = data.shifts.map(({ shift, place, role, client }) => {
    const date = londonParts(shift.startsAt.getTime()).date;
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
    const when = date === today ? `Today, ${day}` : date === addDays(today, 1) ? `Tomorrow, ${day}` : day;
    const breakMinutes = Math.round(
      data.breaks.filter((b) => b.shiftId === shift.id).reduce((m, b) => m + (b.endsAt.getTime() - b.startsAt.getTime()), 0) / MINUTE,
    );
    const worked = Math.round((shift.endsAt.getTime() - shift.startsAt.getTime()) / MINUTE) - breakMinutes;
    const with_ = [
      ...new Set(data.colleagues.filter((c) => c.startsAt < shift.endsAt && c.endsAt > shift.startsAt).map((c) => firstName(c.name))),
    ];
    const lines: { picture: Picture; text: string }[] = [
      { picture: timeOfDay(shift.startsAt), text: `You start at ${spokenTime(shift.startsAt)}.` },
      { picture: "finish", text: `You finish at ${spokenTime(shift.endsAt)}. That is ${spokenLength(worked)} of work.` },
      { picture: "break", text: breakMinutes ? `You have a break of ${spokenLength(breakMinutes)}.` : "There is no set break on this shift." },
      { picture: "place", text: client ? `You are visiting ${client}.` : `You are working at ${place ?? businessName}.` },
      ...(role ? [{ picture: "role" as const, text: `You are working as ${role}.` }] : []),
      { picture: "people", text: with_.length ? `Working at the same time: ${listWords(with_)}.` : "Nobody else is on the rota at the same time." },
      ...(shift.note ? [{ picture: "note" as const, text: `What to expect: ${shift.note}` }] : []),
    ];
    const split = shift.splitGroupId ? " This is one part of a split shift. Clock in and out for each part." : "";
    return { id: shift.id, when, lines, speech: `${when}. ${lines.map((l) => l.text).join(" ")}${split}`, split };
  });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-semibold">Your shifts, made simple</h1>
      <p className="mt-2 text-xl">Your shifts for the next {WEEKS_AHEAD} weeks. Each one has pictures and a button that reads it out loud.</p>
      <p className="mt-2">
        <Link href="/me" className="underline">Back to My shifts</Link>
      </p>

      {cards.length === 0 ? (
        <p className="mt-8 text-xl">You have no shifts in the next {WEEKS_AHEAD} weeks. When your manager adds some, they will show here.</p>
      ) : (
        <>
          <div className="mt-6">
            <ReadAloud text={cards.map((c) => c.speech).join(" ")} label="Read all my shifts aloud" />
          </div>
          <ol className="mt-6 flex flex-col gap-6">
            {cards.map((c) => (
              <li key={c.id} className="rounded-2xl border-2 border-line bg-surface p-5">
                <h2 className="text-2xl font-semibold text-heading">{c.when}</h2>
                <ul className="mt-4 flex flex-col gap-4">
                  {c.lines.map((l, i) => (
                    <Line key={i} picture={l.picture}>{l.text}</Line>
                  ))}
                </ul>
                {c.split && <p className="mt-4 text-lg">{c.split.trim()}</p>}
                <div className="mt-5">
                  <ReadAloud text={c.speech} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
