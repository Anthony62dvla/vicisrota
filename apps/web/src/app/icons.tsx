import type { SVGProps } from "react";

// Simple line icons. They are always decorative: every icon sits next to a visible word.

const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  today: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  rota: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M7 14h3M14 14h3M7 17h3",
  staff: "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.3c2.1.8 3.5 2.9 3.5 5.7",
  roles: "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18",
  staffing: "M6 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM18 6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM2 19a4 4 0 0 1 7-2.6M22 19a4 4 0 0 0-7-2.6M7.5 19.5a4.5 4.5 0 0 1 9 0",
  clients: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0",
  leave: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  sickness: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z",
  timesheets: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9.5 13h6M9.5 17h6",
  shortNotice: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4",
  workingTime: "M3 21h18M6 21V12M11 21V6M16 21v-6M21 21V9",
  tips: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14.8 8.4a2.7 2.7 0 0 0-4.8 1.7c0 1.6.8 2.4.8 3.9 0 .9-.4 1.6-1.3 2.2h5.8M8.6 12.6h4.6",
  workplaces: "M12 21s-7-6-7-11.5a7 7 0 0 1 14 0C19 15 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  announcements: "M4 10v4a1 1 0 0 0 1 1h3l7 4.5v-15L8 9H5a1 1 0 0 0-1 1zM18.5 9a4 4 0 0 1 0 6",
  wellbeing: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  checklist: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  hiring: "M10 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM3.5 20a6.5 6.5 0 0 1 11-4.7M19 14v6M16 17h6",
  messages: "M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5",
  rollCall: "M9 5h10M9 12h10M9 19h10M4 4.5l1.2 1.2L7 3.8M4 11.5l1.2 1.2L7 10.8M4 18.5l1.2 1.2L7 17.8",
  checksDue: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M9 15l2 2 4-4",
  training: "M2 9.5 12 5l10 4.5-10 4.5L2 9.5zM6 11.3V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.7M22 9.5V15",
  sponsorship: "M5 3h11l3 3v15H5V3zM9 9h6M9 13h6M9 17h3M15 3v4h4",
  inspection: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 13l2 2 4-4",
  easyRead: "M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5V5.5zM12 6v13.5",
  loneWorking: "M6 9a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15.5 6 9zM10 20.5a2.2 2.2 0 0 0 4 0",
  safeguarding: "M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6l8-3zM9 12l2 2 4-4",
  display: "M4 7V5h16v2M12 5v14M9 19h6",
  admin: "M12 3l2.4 5.1 5.6.7-4.1 3.9 1 5.5L12 15.6l-4.9 2.6 1-5.5L4 8.8l5.6-.7L12 3z",
  profile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM6.8 18.3a6 6 0 0 1 10.4 0",
  concern: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1zM12 8.5v3.5M12 14.5v.01",
  billing: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM3 10h18M7 14.5h4",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6M12 17v.01",
  more: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  signOut: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h11",
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrow: "M5 12h14M13 6l6 6-6 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The VicisRota mark: a turning arrow around a V, as in the app icon. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" focusable="false" className={className}>
      <rect width="512" height="512" rx="112" fill="var(--brand)" />
      <path d="M256 96a160 160 0 1 1-138.6 80" fill="none" stroke="var(--on-brand)" strokeWidth="36" strokeLinecap="round" />
      <path d="M140 137L147 205L78 165z" fill="var(--on-brand)" stroke="var(--on-brand)" strokeWidth="8" strokeLinejoin="round" />
      <path d="M186 196l70 132 70-132" fill="none" stroke="var(--on-brand)" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
