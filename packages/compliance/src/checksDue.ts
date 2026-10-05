import { addDays } from "./time";

/** How far ahead "due soon" looks. */
export const DUE_SOON_DAYS = 30;

export type DueState = "missing" | "overdue" | "soon" | "later";

export type DueItem = {
  workerId: string;
  workerName: string;
  /** What is due, in plain words: "Right to work follow-up", "DBS recheck", "SIA licence". */
  what: string;
  kind: "right_to_work" | "dbs" | "training" | "supervision" | "appraisal";
  state: DueState;
  /** The date it is due or ran out. Empty when something is missing altogether. */
  dueOn: string | null;
};

export type DuePerson = {
  id: string;
  name: string;
  checks: { kind: "right_to_work" | "dbs"; checkedOn: string; expiresOn: string | null; dbsLevel: string | null; updateService?: boolean }[];
  training: { name: string; expiresOn: string | null }[];
  supervisions?: { kind: "supervision" | "appraisal"; heldOn: string; nextDueOn: string | null }[];
};

const stateFor = (dueOn: string, today: string): DueState =>
  dueOn < today ? "overdue" : dueOn <= addDays(today, DUE_SOON_DAYS) ? "soon" : "later";

const ORDER: Record<DueState, number> = { missing: 0, overdue: 1, soon: 2, later: 3 };

/**
 * Every dated check for a team in one list: right to work follow-ups, DBS rechecks, training and
 * licences (such as an SIA licence) that run out, and supervisions and appraisals. Something with no end
 * date (British citizenship, training that does not expire) is not listed. Missing checks are listed only
 * where the law needs them: right to work for everyone, and an enhanced DBS with barred list where the
 * business does regulated care work.
 */
export const checksDue = (people: DuePerson[], today: string, opts: { requireEnhancedDbs?: boolean } = {}): DueItem[] => {
  const items: DueItem[] = [];
  for (const p of people) {
    const add = (what: string, kind: DueItem["kind"], dueOn: string | null) =>
      items.push({ workerId: p.id, workerName: p.name, what, kind, dueOn, state: dueOn ? stateFor(dueOn, today) : "missing" });

    const rtw = p.checks.filter((c) => c.kind === "right_to_work");
    if (rtw.length === 0) add("Right to work check", "right_to_work", null);
    else if (rtw.every((c) => c.expiresOn)) add("Right to work follow-up", "right_to_work", rtw.map((c) => c.expiresOn!).sort().at(-1)!);

    const dbs = p.checks.filter((c) => c.kind === "dbs");
    if (opts.requireEnhancedDbs && !dbs.some((c) => c.dbsLevel === "enhanced_barred")) add("Enhanced DBS with barred list", "dbs", null);
    // The most recent DBS decides when the next recheck is due.
    const latest = [...dbs].sort((a, b) => a.checkedOn.localeCompare(b.checkedOn)).at(-1);
    if (latest?.expiresOn) add(latest.updateService ? "DBS Update Service check" : "DBS recheck", "dbs", latest.expiresOn);

    const byName = new Map<string, (string | null)[]>();
    for (const t of p.training) byName.set(t.name, [...(byName.get(t.name) ?? []), t.expiresOn]);
    for (const [name, ends] of byName) {
      if (ends.some((e) => !e)) continue;
      add(name, "training", (ends as string[]).sort().at(-1)!);
    }

    for (const kind of ["supervision", "appraisal"] as const) {
      const last = (p.supervisions ?? []).filter((s) => s.kind === kind).sort((a, b) => a.heldOn.localeCompare(b.heldOn)).at(-1);
      if (last?.nextDueOn) add(kind === "supervision" ? "Supervision" : "Appraisal", kind, last.nextDueOn);
    }
  }
  return items.sort(
    (a, b) => ORDER[a.state] - ORDER[b.state] || (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.workerName.localeCompare(b.workerName),
  );
};

/** How many need doing now: missing, overdue or due within DUE_SOON_DAYS. */
export const needsAction = (items: DueItem[]) => items.filter((i) => i.state !== "later");
