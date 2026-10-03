import { schema, type Transaction } from "@vicisrota/db";

/** Under 7 days' warning counts as short notice (the notice period proposed for the Employment Rights Act 2025 regulations). */
export const SHORT_NOTICE_HOURS = 7 * 24;

type NoticeKind = (typeof schema.noticeKind.enumValues)[number];

/** Records that someone's published rota changed, so they see it on their home page. */
export const notify = async (
  tx: Transaction,
  organisationId: string,
  items: { workerId: string | null; shiftId: string; kind: NoticeKind; startsAt: Date; endsAt: Date }[],
) => {
  const now = Date.now();
  const rows = items
    .filter((i): i is typeof i & { workerId: string } => !!i.workerId && i.startsAt.getTime() > now)
    .map((i) => ({ ...i, organisationId, noticeHours: Math.floor((i.startsAt.getTime() - now) / 3_600_000) }));
  if (rows.length) await tx.insert(schema.rotaNotice).values(rows);
};
