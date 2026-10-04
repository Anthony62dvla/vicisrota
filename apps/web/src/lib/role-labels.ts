/** Job role colours, safe to use in the browser. Each badge also shows the role's name, so colour is never the only clue. */
export const ROLE_COLOURS = ["teal", "blue", "purple", "pink", "orange", "green", "grey"] as const;
export type RoleColour = (typeof ROLE_COLOURS)[number];

export const ROLE_COLOUR_LABEL: Record<RoleColour, string> = {
  teal: "Teal",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  orange: "Orange",
  green: "Green",
  grey: "Grey",
};

/** Dark text on a pale fill with a strong border: readable in light and dark mode. */
export const ROLE_BADGE: Record<RoleColour, string> = {
  teal: "border-teal-700 bg-teal-50 text-teal-900 dark:bg-teal-950 dark:text-teal-100",
  blue: "border-blue-700 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  purple: "border-purple-700 bg-purple-50 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
  pink: "border-pink-700 bg-pink-50 text-pink-900 dark:bg-pink-950 dark:text-pink-100",
  orange: "border-orange-700 bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
  green: "border-green-700 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
  grey: "border-zinc-600 bg-zinc-50 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100",
};
