import type { Rule } from "../types";

/**
 * A shift for a job role given to someone not set up to work that role. Not a legal limit, so it warns:
 * a manager may cover a role on purpose, but putting an untrained person in a kitchen or on a senior
 * carer's round should never happen by accident. Training the law requires is checked separately.
 */
export const jobRole: Rule = {
  id: "roles.job-role",
  version: 1,
  title: "Person set up for the shift's job role",
  legalRef: "The business's own job roles. Health and Safety at Work etc. Act 1974, s. 2: staff must have the training to do the work safely.",
  effectiveFrom: "2000-01-01",
  check(ctx) {
    const workers = new Map(ctx.workers.map((w) => [w.id, w]));
    return ctx.shifts.flatMap((shift) => {
      const worker = workers.get(shift.workerId);
      if (!shift.role || !worker || (worker.roles ?? []).includes(shift.role.id)) return [];
      return [
        {
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "warn" as const,
          workerId: worker.id,
          shiftIds: [shift.id],
          message: `${worker.name} is not set up to work as ${shift.role.name}. Check they can do this shift, or add the role on their staff record.`,
          evidence: { roleId: shift.role.id, role: shift.role.name },
          legalRef: this.legalRef,
        },
      ];
    });
  },
};
