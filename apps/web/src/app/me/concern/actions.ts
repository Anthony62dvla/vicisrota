"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import type { FormState } from "@/lib/concern-labels";
import { myClientIds, raiseConcern } from "@/lib/safeguarding";

export async function raiseConcernAsStaff(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const result = await raiseConcern(form, {
    organisationId,
    userId: user.id,
    name: worker.fullName,
    allowedClientIds: await myClientIds(organisationId, worker.id),
  });
  revalidatePath("/me/concern");
  return result;
}
