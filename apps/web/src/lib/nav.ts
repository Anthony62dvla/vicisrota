import type { IconName } from "@/app/icons";

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
};

const item = (href: string, label: string, icon: IconName, exact = false): NavItem => ({ href, label, icon, exact });

/** The menu for managers and owners. Sector decides between Tips (hospitality, shops) and Clients (care). */
export const managerNav = (sector: "care" | "hospitality" | "small_business", superadmin: boolean): NavSection[] => [
  { title: null, items: [item("/dashboard", "Home", "home", true), item("/attendance", "Today", "today")] },
  {
    title: "Plan",
    items: [
      item("/rota", "Rota", "rota"),
      item("/staff", "Staff", "staff"),
      item("/roles", "Job roles", "roles"),
      ...(sector === "care" ? [item("/clients", "Clients", "clients")] : []),
    ],
  },
  { title: "Time off", items: [item("/leave", "Leave", "leave"), item("/sickness", "Sickness", "sickness")] },
  {
    title: "Pay and hours",
    items: [
      item("/timesheets", "Timesheets", "timesheets"),
      item("/working-time", "Working time", "workingTime"),
      item("/short-notice", "Short-notice pay", "shortNotice"),
      ...(sector !== "care" ? [item("/tips", "Tips", "tips")] : []),
    ],
  },
  { title: "Your team", items: [item("/announcements", "Announcements", "announcements"), item("/workplaces", "Workplaces", "workplaces")] },
  { title: "Safety", items: [item("/lone-working", "Lone working", "loneWorking"), item("/safeguarding", "Safeguarding", "safeguarding")] },
  {
    title: null,
    items: [
      item("/display", "Display settings", "display"),
      item("/help", "Report a problem", "help"),
      ...(superadmin ? [item("/admin", "VicisRota superadmin", "admin")] : []),
    ],
  },
];

export const managerPhoneBar: NavItem[] = [
  item("/dashboard", "Home", "home", true),
  item("/attendance", "Today", "today"),
  item("/rota", "Rota", "rota"),
  item("/staff", "Staff", "staff"),
];

/** The menu for staff: their own shifts and nothing about anyone else. */
export const staffNav: NavSection[] = [
  {
    title: null,
    items: [
      item("/me", "My shifts", "rota", true),
      item("/me/profile", "How I work best", "profile"),
      item("/me/concern", "Raise a concern", "concern"),
      item("/display", "Display settings", "display"),
      item("/help", "Report a problem", "help"),
    ],
  },
];

export const staffPhoneBar: NavItem[] = staffNav[0]!.items.slice(0, 4);

/** Pages that show without the app menu: signing in, joining, the shared clock-in tablet and the public home page. */
export const showsMenu = (pathname: string) =>
  !["/", "/sign-in", "/sign-up", "/kiosk", "/offline"].includes(pathname) && !pathname.startsWith("/join/") && !pathname.startsWith("/welcome/") && pathname !== "/workplaces/poster";

export const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
