/**
 * Sector packs: what a new business starts with, chosen by the kind of business at setup. Each pack sets
 * the broad sector (which turns on features such as care clients or tips), whether every shift needs an
 * enhanced DBS check, and ready-made job roles, training and checklists the manager can change later.
 */
export type Sector = "care" | "hospitality" | "small_business";

export type Pack = {
  id: string;
  label: string;
  hint: string;
  sector: Sector;
  /** Regulated activity with children or adults: every shift needs an enhanced DBS check with barred list. */
  enhancedDbs: boolean;
  /** Id of the group in role-suggestions.ts whose roles are added. */
  roleGroup: string;
  tips: boolean;
  training: string[];
  checklists: { name: string; items: string[] }[];
};

export const PACKS: Pack[] = [
  {
    id: "care_home",
    label: "Care home",
    hint: "Residential or nursing care for adults",
    sector: "care",
    enhancedDbs: true,
    roleGroup: "care-home",
    tips: false,
    training: ["Safeguarding adults", "Moving and handling", "Medication administration", "First aid", "Infection prevention and control", "Care Certificate"],
    checklists: [
      {
        name: "Start of shift",
        items: ["Read the handover notes and care plans for anyone whose needs have changed", "Check the medication trolley is locked", "Check call bells are in reach"],
      },
      { name: "Night checks", items: ["Check on each resident as their care plan says", "Record each check", "Check the fire exits are clear"] },
    ],
  },
  {
    id: "home_care",
    label: "Home care",
    hint: "Visiting people in their own homes",
    sector: "care",
    enhancedDbs: true,
    roleGroup: "care-home",
    tips: false,
    training: ["Safeguarding adults", "Moving and handling", "Medication administration", "First aid", "Infection prevention and control", "Care Certificate"],
    checklists: [
      {
        name: "Each visit",
        items: ["Read the latest care notes before going in", "Check the person is safe and well", "Write up what you did in the care notes", "Lock up and close the key safe"],
      },
    ],
  },
  {
    id: "childrens_home",
    label: "Children's home",
    hint: "Residential care for children and young people",
    sector: "care",
    enhancedDbs: true,
    roleGroup: "childrens-home",
    tips: false,
    training: ["Safeguarding children", "First aid", "Medication administration", "Positive behaviour support"],
    checklists: [
      {
        name: "Start of shift",
        items: ["Read the daily log and handover notes", "Check where each young person is", "Check the medication records", "Check today's appointments and school plans"],
      },
    ],
  },
  {
    id: "nursery",
    label: "Nursery or childcare",
    hint: "Early years settings, before and after school clubs",
    sector: "small_business",
    enhancedDbs: true,
    roleGroup: "nursery",
    tips: false,
    training: ["Paediatric first aid", "Safeguarding children", "Food hygiene"],
    checklists: [
      {
        name: "Opening checks",
        items: ["Check indoor and outdoor areas are safe before children arrive", "Check the first aid kit is stocked", "Check each room has enough staff for the children booked in"],
      },
      { name: "Closing checks", items: ["Check every child has been collected and signed out", "Check the register is complete", "Lock up and set the alarm"] },
    ],
  },
  {
    id: "hospitality",
    label: "Pub, restaurant, café or hotel",
    hint: "Hospitality",
    sector: "hospitality",
    enhancedDbs: false,
    roleGroup: "hospitality",
    tips: true,
    training: ["Food hygiene (level 2)", "Allergen awareness", "Personal licence (alcohol)", "First aid"],
    checklists: [
      {
        name: "Opening checks",
        items: ["Check and record fridge and freezer temperatures", "Check the allergen information is up to date", "Unlock the fire exits and check they are clear"],
      },
      { name: "Closing checks", items: ["Check and record fridge and freezer temperatures", "Clean down and sanitise surfaces", "Lock up and set the alarm"] },
    ],
  },
  {
    id: "retail",
    label: "Shop",
    hint: "Retail",
    sector: "small_business",
    enhancedDbs: false,
    roleGroup: "retail",
    tips: false,
    training: ["Age-restricted sales (Challenge 25)", "Fire marshal", "First aid"],
    checklists: [
      { name: "Opening checks", items: ["Unlock the fire exits and check they are clear", "Count the float into the till", "Check the shop floor is safe and tidy"] },
      { name: "Closing checks", items: ["Cash up and record the till total", "Check nobody is left in the shop", "Lock up and set the alarm"] },
    ],
  },
  {
    id: "cleaning",
    label: "Cleaning",
    hint: "Commercial or domestic cleaning",
    sector: "small_business",
    enhancedDbs: false,
    roleGroup: "cleaning",
    tips: false,
    training: ["Hazardous substances (COSHH)", "Working at height", "First aid"],
    checklists: [
      {
        name: "Each site",
        items: ["Sign in at the site if asked to", "Put out wet floor signs before mopping", "Store cleaning products safely after use", "Report anything damaged or unsafe"],
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    hint: "Manned guarding, door supervision, events",
    sector: "small_business",
    enhancedDbs: false,
    roleGroup: "security",
    tips: false,
    training: ["SIA licence", "First aid", "Conflict management"],
    checklists: [
      { name: "Start of shift", items: ["Check in with the control room", "Check your radio and torch work", "Read the incident log and handover notes"] },
      { name: "End of shift", items: ["Write up any incidents in the log", "Hand over keys and equipment", "Check in with the control room"] },
    ],
  },
  {
    id: "other",
    label: "Another kind of business",
    hint: "Offices, trades, warehouses and anything else",
    sector: "small_business",
    enhancedDbs: false,
    roleGroup: "small-business",
    tips: false,
    training: ["First aid", "Fire marshal"],
    checklists: [],
  },
];

export const packById = (id: string | null | undefined) => PACKS.find((p) => p.id === id);

const LEGACY_LABEL: Record<Sector, string> = { care: "Care provider", hospitality: "Hospitality", small_business: "Small business" };

/** What to call the business's kind, for businesses set up before or after packs. */
export const kindLabel = (kind: string | null, sector: Sector) => packById(kind)?.label ?? LEGACY_LABEL[sector];

/** Which sector-specific pages a business sees. Businesses from before packs keep what they had. */
export const featuresFor = (kind: string | null, sector: Sector) => {
  const pack = packById(kind);
  return {
    clients: sector === "care",
    inspection: sector === "care",
    tips: pack ? pack.tips : sector !== "care",
  };
};
