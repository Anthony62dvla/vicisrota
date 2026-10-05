import type { ReactNode } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { currentMembership, myBusinesses } from "@/lib/business";
import { managerNav, managerPhoneBar, staffNav, staffPhoneBar, type Nav, type NavItem } from "@/lib/nav";
import { localeOf } from "@vicisrota/messaging";
import { messagesFor } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { isSuperadmin } from "@/lib/superadmin";
import { AppFrame } from "./app-frame";

/** Wraps every page. Signed-in people get the app menu for their role; everyone else gets the page on its own. */
export async function AppShell({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const membership = session ? await currentMembership(session.user.id) : undefined;
  let nav: Nav | null = null;
  if (session && membership) {
    const worker = membership.role === "worker";
    // Staff menus are translated. Managers' pages are English for now, so their menu is too.
    const lang = worker ? await getLang() : "en";
    const t = messagesFor(lang);
    const say = (items: NavItem[], bar = false) => items.map((i) => ({ ...i, label: (bar && t.bar[i.href]) || t.nav[i.href] || i.label }));
    nav = {
      businessName: membership.name,
      businesses: (await myBusinesses(session.user.id)).map((b) => ({ id: b.organisationId, name: b.name, current: b.organisationId === membership.organisationId })),
      userName: session.user.name,
      sections: worker ? staffNav.map((s) => ({ ...s, items: say(s.items) })) : managerNav(membership.sector, await isSuperadmin(session.user.id), membership.kind),
      phoneBar: worker ? say(staffPhoneBar, true) : managerPhoneBar,
      words: t.frame,
      lang: localeOf(lang),
    };
  }
  return <AppFrame nav={nav}>{children}</AppFrame>;
}
