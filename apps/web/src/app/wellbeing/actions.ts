"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

/** Records that a manager has had the chat someone asked for. */
export async function markChatHandled(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .update(schema.wellbeingCheckIn)
      .set({ chatHandledAt: new Date() })
      .where(and(eq(schema.wellbeingCheckIn.id, id), eq(schema.wellbeingCheckIn.wantsChat, true), isNull(schema.wellbeingCheckIn.chatHandledAt)))
      .returning({ id: schema.wellbeingCheckIn.id });
    if (row) await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "chat_handled", entity: "wellbeing_check_in", entityId: id });
  });
  revalidatePath("/wellbeing");
}
