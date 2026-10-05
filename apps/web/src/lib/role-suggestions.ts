import type { RoleColour } from "./role-labels";

export type SuggestedGroup = { id: string; title: string; sectors: ("care" | "hospitality" | "small_business")[]; roles: [string, RoleColour][] };

/**
 * Job roles common in UK small businesses, hospitality, care homes and children's homes, offered as
 * ready-made choices so managers do not start from a blank page. Colours group similar work: leadership
 * teal, care and nursing purple, kitchen orange, front of house blue, support and facilities grey.
 */
export const SUGGESTED_ROLES: SuggestedGroup[] = [
  {
    id: "care-home",
    title: "Care homes and home care",
    sectors: ["care"],
    roles: [
      ["Registered manager", "teal"],
      ["Deputy manager", "teal"],
      ["Care supervisor", "teal"],
      ["Team leader", "teal"],
      ["Nurse", "purple"],
      ["Doctor", "purple"],
      ["Senior carer", "purple"],
      ["Carer", "purple"],
      ["Activities coordinator", "green"],
      ["Cook", "orange"],
      ["Kitchen assistant", "orange"],
      ["Housekeeper", "grey"],
      ["Laundry assistant", "grey"],
      ["Maintenance", "grey"],
      ["Administrator", "grey"],
    ],
  },
  {
    id: "childrens-home",
    title: "Children's homes",
    sectors: ["care"],
    roles: [
      ["Registered manager", "teal"],
      ["Deputy manager", "teal"],
      ["Senior residential childcare worker", "teal"],
      ["Residential childcare worker", "pink"],
      ["Waking night worker", "pink"],
      ["Sleep-in worker", "pink"],
      ["Education support worker", "green"],
      ["Therapist", "purple"],
      ["Nurse", "purple"],
      ["Cook", "orange"],
      ["Domestic assistant", "grey"],
    ],
  },
  {
    id: "hospitality",
    title: "Hospitality",
    sectors: ["hospitality"],
    roles: [
      ["General manager", "teal"],
      ["Assistant manager", "teal"],
      ["Supervisor", "teal"],
      ["Front of house", "blue"],
      ["Host", "blue"],
      ["Waiter", "blue"],
      ["Bartender", "blue"],
      ["Barista", "blue"],
      ["Receptionist", "blue"],
      ["Head chef", "orange"],
      ["Sous chef", "orange"],
      ["Chef", "orange"],
      ["Commis chef", "orange"],
      ["Kitchen porter", "orange"],
      ["Room attendant", "grey"],
      ["Housekeeper", "grey"],
      ["Events coordinator", "green"],
    ],
  },
  {
    id: "small-business",
    title: "Small businesses",
    sectors: ["small_business"],
    roles: [
      ["Manager", "teal"],
      ["Site manager", "teal"],
      ["Supervisor", "teal"],
      ["Foreperson", "teal"],
      ["Sales assistant", "blue"],
      ["Cashier", "blue"],
      ["Customer service", "blue"],
      ["Marketing manager", "green"],
      ["Administrator", "green"],
      ["Stock and warehouse", "grey"],
      ["Driver", "grey"],
      ["Facilities team", "grey"],
      ["Cleaner", "grey"],
      ["Security officer", "grey"],
      ["First aider", "pink"],
      ["Fire marshal", "pink"],
    ],
  },
  {
    id: "nursery",
    title: "Nurseries and childcare",
    sectors: [],
    roles: [
      ["Nursery manager", "teal"],
      ["Deputy manager", "teal"],
      ["Room leader", "teal"],
      ["Nursery practitioner", "pink"],
      ["Nursery assistant", "pink"],
      ["Apprentice practitioner", "pink"],
      ["SENCO", "purple"],
      ["Cook", "orange"],
      ["Administrator", "grey"],
    ],
  },
  {
    id: "retail",
    title: "Shops",
    sectors: [],
    roles: [
      ["Store manager", "teal"],
      ["Assistant manager", "teal"],
      ["Supervisor", "teal"],
      ["Sales assistant", "blue"],
      ["Cashier", "blue"],
      ["Visual merchandiser", "green"],
      ["Stock and warehouse", "grey"],
      ["Delivery driver", "grey"],
    ],
  },
  {
    id: "cleaning",
    title: "Cleaning",
    sectors: [],
    roles: [
      ["Operations manager", "teal"],
      ["Area supervisor", "teal"],
      ["Cleaner", "grey"],
      ["Specialist cleaner", "grey"],
      ["Window cleaner", "grey"],
      ["Housekeeper", "grey"],
    ],
  },
  {
    id: "security",
    title: "Security",
    sectors: [],
    roles: [
      ["Security manager", "teal"],
      ["Shift supervisor", "teal"],
      ["Security officer", "blue"],
      ["Door supervisor", "blue"],
      ["CCTV operator", "grey"],
      ["Key holder", "grey"],
      ["Event steward", "green"],
    ],
  },
];

/** The business's own kind first, then groups for its sector, then the rest, for businesses that do a bit of everything. */
export const suggestionsFor = (sector: string, ownGroup?: string) => {
  const rank = (g: SuggestedGroup) => (g.id === ownGroup ? 0 : g.sectors.includes(sector as never) ? 1 : 2);
  return [...SUGGESTED_ROLES].sort((a, b) => rank(a) - rank(b));
};

/** Every suggested role by lower-case name, so the server only accepts names from this list. */
export const SUGGESTED_BY_NAME = new Map(SUGGESTED_ROLES.flatMap((g) => g.roles).map(([name, colour]) => [name.toLowerCase(), { name, colour }]));
