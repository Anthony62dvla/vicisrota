import type { ReactNode } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { currentMembership, myBusinesses } from "@/lib/business";
import { managerNav, managerPhoneBar, staffNav, staffPhoneBar, type Nav } from "@/lib/nav";
import { isSuperadmin } from "@/lib/superadmin";
import { AppFrame } from "./app-frame";

/** Wraps every page. Signed-in people get the app menu for their role; everyone else gets the page on its own. */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const membership = session ? await currentMembership(session.user.id) : undefined;
  let nav: Nav | null = null;
  if (session && membership) {
    const worker = membership.role === "worker";
    nav = {
      businessName: membership.name,
      businesses: (await myBusinesses(session.user.id)).map((b) => ({ id: b.organisationId, name: b.name, current: b.organisationId === membership.organisationId })),
      userName: session.user.name,
      sections: worker ? staffNav : managerNav(membership.sector, await isSuperadmin(session.user.id)),
      phoneBar: worker ? staffPhoneBar : managerPhoneBar,
    };
  }
  return <AppFrame nav={nav}>{children}</AppFrame>;
}
