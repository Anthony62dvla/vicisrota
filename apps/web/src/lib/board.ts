import { evaluate, londonParts, type Context, type Finding } from "@vicisrota/compliance";
import type { CheckShift } from "./rota";

export type Candidate = { workerId: string; blocks: Finding[]; warnings: Finding[] };

/**
 * Tries an open shift against every person, running the same rules as publishing, and keeps only the
 * problems that involve this shift and that person. People who can take it come first, those with
 * fewer hours that week before those with more, so extra work is shared out fairly.
 */
export const candidatesFor = (context: Context, open: CheckShift, hoursThisWeek: Map<string, number>): Candidate[] =>
  context.workers
    .map((w) => {
      const findings = evaluate({ ...context, shifts: [...context.shifts, { ...open, workerId: w.id }] }).findings.filter(
        (f) => f.workerId === w.id && f.shiftIds.includes(open.id),
      );
      return { workerId: w.id, blocks: findings.filter((f) => f.severity === "block"), warnings: findings.filter((f) => f.severity === "warn") };
    })
    .sort(
      (a, b) =>
        Number(a.blocks.length > 0) - Number(b.blocks.length > 0) ||
        a.warnings.length - b.warnings.length ||
        (hoursThisWeek.get(a.workerId) ?? 0) - (hoursThisWeek.get(b.workerId) ?? 0),
    );

const hhmm = (ms: number) => {
  const p = londonParts(ms);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/** The start and finish times this business uses most, offered as one-tap choices when adding a shift. */
export const usualTimes = (shifts: { startsAt: Date; endsAt: Date }[], limit = 4) => {
  const counts = new Map<string, number>();
  for (const s of shifts) {
    const key = `${hhmm(s.startsAt.getTime())}-${hhmm(s.endsAt.getTime())}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => {
      const [start, end] = key.split("-") as [string, string];
      return { start, end };
    });
};
