"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";

/** Records that the person has read their statement. Only ever their own. */
export async function markStatementRead(form: FormData) {
  const { organisationId, worker } = await requireStaff();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.writtenStatement)
      .set({ readAt: new Date() })
      .where(and(eq(schema.writtenStatement.id, id), eq(schema.writtenStatement.workerId, worker.id), isNull(schema.writtenStatement.readAt))),
  );
  revalidatePath("/me/statement");
  revalidatePath("/me");
}
