import { addDays, londonDateTime, londonParts, ms } from "../time";
import type { Rule } from "../types";

export const LICENCE_LEGAL_REF =
  "Licensing Act 2003, s 19 (every sale of alcohol must be made or authorised by a personal licence holder) and the conditions on your premises licence";

const MIN_GAP = 15 * 60_000;
type Span = [number, number];

/** Joins overlapping spans into a sorted list. */
const union = (spans: Span[]): Span[] =>
  [...spans]
    .sort((a, b) => a[0] - b[0])
    .reduce<Span[]>((out, s) => {
      const last = out[out.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else out.push([...s]);
      return out;
    }, []);

/** The parts of `spans` not covered by `cover`. Both sorted and joined. */
const minus = (spans: Span[], cover: Span[]): Span[] =>
  spans.flatMap(([from, to]) => {
    const left: Span[] = [];
    let at = from;
    for (const [c0, c1] of cover) {
      if (c1 <= at || c0 >= to) continue;
      if (c0 > at) left.push([at, c0]);
      at = Math.max(at, c1);
    }
    if (at < to) left.push([at, to]);
    return left;
  });

const intersect = (a: Span[], b: Span[]): Span[] =>
  a.flatMap(([a0, a1]) => b.filter(([b0, b1]) => b0 < a1 && a0 < b1).map(([b0, b1]): Span => [Math.max(a0, b0), Math.min(a1, b1)]));

const time = (t: number) => {
  const { hour, minute } = londonParts(t);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};
const day = (t: number) => new Date(`${londonParts(t).date}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/**
 * At a place that sells alcohol, someone with a personal licence should be on shift whenever staff are working
 * (or, when the business sets them, during its licensed hours). The law only needs every sale to be authorised by a
 * licence holder, but many premises licences require one on site, so a gap is a warning the manager can accept.
 */
export const licenceHolder: Rule = {
  id: "hospitality.licence-holder",
  version: 1,
  title: "Personal licence holder on shift",
  legalRef: LICENCE_LEGAL_REF,
  effectiveFrom: "2005-11-24",
  check(ctx) {
    const lic = ctx.licensing;
    if (!lic?.places.length) return [];
    const holders = new Set(lic.holderIds);
    return lic.places.flatMap((place) => {
      const here = ctx.shifts.filter((s) => (s.locationId ?? null) === place.locationId);
      if (!here.length) return [];
      const staffed = union(here.map((s) => [ms(s.start), ms(s.end)]));
      let gaps = minus(staffed, union(here.filter((s) => holders.has(s.workerId)).map((s) => [ms(s.start), ms(s.end)])));
      if (place.hours) {
        const { from, to } = place.hours;
        const first = londonParts(staffed[0]![0]).date;
        const last = londonParts(staffed[staffed.length - 1]![1]).date;
        const windows: Span[] = [];
        for (let d = addDays(first, -1); d <= last; d = addDays(d, 1)) windows.push([londonDateTime(d, from), londonDateTime(to > from ? d : addDays(d, 1), to)]);
        gaps = intersect(gaps, union(windows));
      }
      return gaps
        .filter(([a, b]) => b - a >= MIN_GAP)
        .map(([a, b]) => {
          const shifts = here.filter((s) => ms(s.start) < b && a < ms(s.end));
          return {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "warn" as const,
            workerId: shifts[0]!.workerId,
            shiftIds: shifts.map((s) => s.id),
            message: `No one with a personal licence is on shift${place.name ? ` at ${place.name}` : ""} on ${day(a)} from ${time(a)} to ${time(b)}. Alcohol can only be sold with a licence holder's authority, and your premises licence may need one on site.`,
            evidence: { from: new Date(a).toISOString(), to: new Date(b).toISOString(), place: place.name },
            legalRef: this.legalRef,
          };
        });
    });
  },
};
