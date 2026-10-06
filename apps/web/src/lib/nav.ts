import type { IconName } from "@/app/icons";
import { featuresFor, type Sector } from "./sector-packs";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };
export type NavSection = { title: string | null; items: NavItem[] };
export type Nav = {
  businessName: string;
  /** Every business this login belongs to, so people who work for more than one can switch. */
  businesses: { id: string; name: string; current: boolean }[];
  userName: string;
  sections: NavSection[];
  /** Shown in the bar along the bottom of a phone screen. Everything else is under "More". */
  phoneBar: NavItem[];
  /** The words around the menu, in the person's language. */
  /**
   * The language of the menu, for screen readers. Pages not yet translated stay in English, so the
   * language is set on the translated parts rather than the whole page.
   */
  lang: string;
  words: { skip: string; more: string; close: string; signOut: string; businesses: string; menu: string };
};

const item = (href: string, label: string, icon: IconName, exact = false): NavItem => ({ href, label, icon, exact });

/** The menu for managers and owners. The kind of business decides sector pages such as Tips, Clients and the inspection pack. */
export const managerNav = (sector: Sector, superadmin: boolean, kind: string | null = null): NavSection[] => {
  const has = featuresFor(kind, sector);
  return [
  { title: null, items: [item("/dashboard", "Home", "home", true), item("/attendance", "Today", "today")] },
  {
    title: "Plan",
    items: [
      item("/rota", "Rota", "rota"),
      item("/staff", "Staff", "staff"),
      item("/roles", "Job roles", "roles"),
      item("/staffing", "Safe staffing", "staffing"),
      item("/fairness", "Fair shares", "fairness"),
      item("/hiring", "Hiring", "hiring"),
      item("/agency", "Agency workers", "agency"),
      ...(has.clients ? [item("/clients", "Clients", "clients")] : []),
    ],
  },
  { title: "Time off", items: [item("/leave", "Leave", "leave"), item("/sickness", "Sickness", "sickness")] },
  {
    title: "Pay and hours",
    items: [
      item("/timesheets", "Timesheets", "timesheets"),
      item("/working-time", "Working time", "workingTime"),
      item("/short-notice", "Short-notice pay", "shortNotice"),
      item("/guaranteed-hours", "Guaranteed hours", "guaranteedHours"),
      ...(has.tips ? [item("/tips", "Tips", "tips")] : []),
    ],
  },
  { title: "Your team", items: [item("/messages", "Messages", "messages"), item("/checklists", "Checklists", "checklist"), item("/wellbeing", "Wellbeing", "wellbeing"), item("/announcements", "Announcements", "announcements"), item("/statements", "Written statements", "statements"), item("/workplaces", "Workplaces", "workplaces")] },
  {
    title: "Safety",
    items: [
      item("/checks", "Checks due", "checksDue"), item("/training", "Training", "training"), item("/roll-call", "Fire roll call", "rollCall"), item("/lone-working", "Lone working", "loneWorking"), item("/safeguarding", "Safeguarding", "safeguarding"),
      item("/sponsorship", "Sponsored workers", "sponsorship"),
      ...(has.inspection ? [item("/inspection", "Inspection pack", "inspection")] : []),
    ],
  },
  {
    title: null,
    items: [
      item("/display", "Display and language", "display"),
      item("/billing", "Plan and billing", "billing"),
      item("/security", "Sign-in security", "security"),
      item("/help", "Report a problem", "help"),
      ...(superadmin ? [item("/admin", "VicisRota superadmin", "admin")] : []),
    ],
  },
  ];
};

export const managerPhoneBar: NavItem[] = [
  item("/dashboard", "Home", "home", true),
  item("/attendance", "Today", "today"),
  item("/rota", "Rota", "rota"),
  item("/messages", "Messages", "messages"),
];

/** The menu for staff: their own shifts and nothing about anyone else. */
export const staffNav: NavSection[] = [
  {
    title: null,
    items: [
      item("/me", "My shifts", "rota", true),
      item("/messages", "Messages", "messages"),
      item("/me/checklist", "Today's checklist", "checklist"),
      item("/me/easy-read", "Easy Read shifts", "easyRead"),
      item("/me/wellbeing", "Wellbeing", "wellbeing"),
      item("/me/profile", "How I work best", "profile"),
      item("/me/concern", "Raise a concern", "concern"),
      item("/display", "Display and language", "display"),
      item("/security", "Sign-in security", "security"),
      item("/help", "Report a problem", "help"),
    ],
  },
];

/** My shifts, Messages, Easy Read and Raise a concern: a concern is always one tap away. */
export const staffPhoneBar: NavItem[] = ["/me", "/messages", "/me/easy-read", "/me/concern"].map((href) => staffNav[0]!.items.find((i) => i.href === href)!);

/** Pages that show without the app menu: signing in, joining, the shared clock-in tablet and the public home page. */
export const showsMenu = (pathname: string) =>
  !["/", "/sign-in", "/sign-up", "/kiosk", "/offline", "/terms", "/privacy"].includes(pathname) && !pathname.startsWith("/join/") && !pathname.startsWith("/sign-in/") && !pathname.startsWith("/welcome/") && !pathname.startsWith("/jobs/") && pathname !== "/workplaces/poster";

export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
