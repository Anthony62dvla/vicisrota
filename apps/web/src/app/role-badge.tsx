import { ROLE_BADGE, type RoleColour } from "@/lib/role-labels";

export function RoleBadge({ name, colour }: { name: string; colour: RoleColour }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-sm font-medium ${ROLE_BADGE[colour]}`}>{name}</span>;
}
