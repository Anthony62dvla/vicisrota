import { ms } from "../time";
import type { Rule } from "../types";

export const KEEP_APART_LEGAL_REF =
  "Equality Act 2010, s 40A (duty to take reasonable steps to prevent sexual harassment, from 26 October 2024); Health and Safety at Work etc. Act 1974, s 2";

/**
 * Two people a manager has decided to keep apart, for example after a harassment complaint or a
 * safeguarding concern, must not be on overlapping shifts at the same workplace. The reason is never
 * recorded here or shown to staff.
 */
export const keepApart: Rule = {
  id: "safety.keep-apart",
  version: 1,
  title: "People kept apart",
  legalRef: KEEP_APART_LEGAL_REF,
  effectiveFrom: "2010-10-01",
  check(ctx) {
    const pairs = ctx.keepApart ?? [];
    if (!pairs.length) return [];
    const names = new Map(ctx.workers.map((w) => [w.id, w.name]));
    return pairs.flatMap(({ workerIds: [a, b] }) => {
      const first = ctx.shifts.filter((s) => s.workerId === a);
      const second = ctx.shifts.filter((s) => s.workerId === b);
      return first.flatMap((x) =>
        second
          .filter((y) => ms(x.start) < ms(y.end) && ms(y.start) < ms(x.end))
          // Different workplaces at the same time are fine.
          .filter((y) => !(x.locationId && y.locationId && x.locationId !== y.locationId))
          .flatMap((y) =>
            [a, b].map((workerId) => ({
              ruleId: this.id,
              ruleVersion: this.version,
              severity: "block" as const,
              workerId,
              shiftIds: [x.id, y.id],
              message: `${names.get(a) ?? "One person"} and ${names.get(b) ?? "another person"} are set to be kept apart, and these shifts overlap. Move one of them.`,
              evidence: { otherWorkerId: workerId === a ? b : a },
              legalRef: this.legalRef,
              confidential: true,
            })),
          ),
      );
    });
  },
};
