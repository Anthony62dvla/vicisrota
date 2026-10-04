import { addDays, londonParts, ms, shiftsByWorker } from "../time";
import type { LeaveKind, Rule, Shift } from "../types";

const KIND_LABEL: Record<LeaveKind, string> = {
  annual: "holiday",
  sick: "sick leave",
  family: "family leave",
  unpaid: "unpaid leave",
  compassionate: "compassionate leave",
  other: "leave",
};

/** Every UK calendar date a shift touches; an overnight shift touches two. */
const shiftDates = (s: Shift): string[] => {
  const first = londonParts(ms(s.start)).date;
  const last = londonParts(ms(s.end) - 1).date;
  const dates = [first];
  while (dates.at(-1)! < last) dates.push(addDays(dates.at(-1)!, 1));
  return dates;
};

export const noShiftDuringLeave: Rule = {
  id: "leave.no-shift-during-leave",
  version: 1,
  title: "No shifts during leave",
  legalRef: "Working Time Regulations 1998, regs 13 to 16; Employment Rights Act 1996, Part 8",
  effectiveFrom: "1998-10-01",
  check(ctx) {
    const names = new Map(ctx.workers.map((w) => [w.id, w.name]));
    return [...shiftsByWorker(ctx.shifts)].flatMap(([workerId, shifts]) => {
      const leave = (ctx.leave ?? []).filter((l) => l.workerId === workerId);
      if (!leave.length) return [];
      const name = names.get(workerId) ?? "This person";
      return shifts.flatMap((shift) => {
        const dates = shiftDates(shift);
        const clash = leave.find((l) => dates.some((d) => d >= l.startsOn && d <= l.endsOn));
        if (!clash) return [];
        const day = dates.find((d) => d >= clash.startsOn && d <= clash.endsOn)!;
        const approved = clash.status === "approved";
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: approved ? ("block" as const) : ("warn" as const),
            workerId,
            shiftIds: [shift.id],
            message: approved
              ? `${name} is on approved ${KIND_LABEL[clash.kind]} on ${day}. Move this shift to someone else.`
              : `${name} has asked for ${KIND_LABEL[clash.kind]} on ${day}. Decide on the request before relying on this shift.`,
            evidence: { date: day, leaveKind: clash.kind, leaveStatus: clash.status, startsOn: clash.startsOn, endsOn: clash.endsOn },
            legalRef: this.legalRef,
          },
        ];
      });
    });
  },
};
