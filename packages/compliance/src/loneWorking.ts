/**
 * Lone working check-ins. Employers must assess and control the risks of working alone
 * (Health and Safety at Work etc. Act 1974; Management of Health and Safety at Work Regulations 1999,
 * reg. 3; HSE guidance INDG73). A common control is a check-in at the start, at set intervals and at
 * the end, with someone alerted when a check-in is missed. This decides who needs attention.
 */

export type LoneCheckKind = "start" | "ok" | "finished" | "help" | "resolved";

export interface LoneCheck {
  kind: LoneCheckKind;
  at: number;
}

export type LoneWorkState =
  /** Shift has not started yet. */
  | "not_started"
  /** Checked in recently; nothing to do. */
  | "ok"
  /** Asked for help and nobody has marked it dealt with. */
  | "help"
  /** A check-in is late by more than the grace period. */
  | "overdue"
  /** Checked out safely. */
  | "finished";

export interface LoneWorkStatus {
  state: LoneWorkState;
  /** When the next check-in is due (start, interval or finish), or null when finished. */
  dueAt: number | null;
  /** What is late, in plain words, when overdue. */
  reason?: string;
}

/** Minutes allowed after a check-in falls due before it counts as missed. */
export const LONE_WORK_GRACE_MINUTES = 15;

const MIN = 60_000;

export const loneWorkStatus = (input: {
  start: number;
  end: number;
  intervalMinutes: number;
  checks: LoneCheck[];
  now: number;
  graceMinutes?: number;
}): LoneWorkStatus => {
  const grace = (input.graceMinutes ?? LONE_WORK_GRACE_MINUTES) * MIN;
  const checks = [...input.checks].sort((a, b) => a.at - b.at);
  // A call for help stays open until a manager marks it dealt with.
  const lastHelp = checks.filter((c) => c.kind === "help").at(-1);
  const lastResolved = checks.filter((c) => c.kind === "resolved").at(-1);
  if (lastHelp && (!lastResolved || lastResolved.at < lastHelp.at)) return { state: "help", dueAt: null };

  if (checks.some((c) => c.kind === "finished")) return { state: "finished", dueAt: null };
  // A manager marking a missed check-in as dealt with (having reached the person) counts as a check-in.
  const started = checks.length > 0;
  const last = checks.at(-1);

  if (!started) {
    if (input.now < input.start) return { state: "not_started", dueAt: input.start };
    return input.now > input.start + grace
      ? { state: "overdue", dueAt: input.start, reason: "has not checked in at the start of their shift" }
      : { state: "ok", dueAt: input.start };
  }
  const next = Math.min(last!.at + input.intervalMinutes * MIN, input.end);
  if (input.now > next + grace) {
    return { state: "overdue", dueAt: next, reason: next === input.end ? "has not checked out at the end of their shift" : "has missed a check-in" };
  }
  return { state: "ok", dueAt: next };
};
