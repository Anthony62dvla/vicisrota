import { schema, type Transaction as Tx } from "@vicisrota/db";
import { SUGGESTED_ROLES } from "./role-suggestions";
import type { Pack } from "./sector-packs";

/**
 * Gives a new business its pack's starting roles, training and checklists. Run inside the transaction
 * that creates the business, with app.organisation_id already set. Everything can be changed later.
 */
export const applyPack = async (tx: Tx, organisationId: string, pack: Pack) => {
  const roles = SUGGESTED_ROLES.find((g) => g.id === pack.roleGroup)?.roles ?? [];
  if (roles.length) await tx.insert(schema.jobRole).values(roles.map(([name, colour]) => ({ organisationId, name, colour }))).onConflictDoNothing();
  if (pack.training.length) await tx.insert(schema.qualification).values(pack.training.map((name) => ({ organisationId, name })));
  if (pack.checklists.length) await tx.insert(schema.checklistTemplate).values(pack.checklists.map((c) => ({ organisationId, name: c.name, items: c.items })));
  return { roles: roles.length, training: pack.training.length, checklists: pack.checklists.length };
};
