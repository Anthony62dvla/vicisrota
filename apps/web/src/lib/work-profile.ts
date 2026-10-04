import type { schema } from "@vicisrota/db";

export type WorkProfile = schema.WorkProfile;
export type ContactWay = schema.ContactWay;

/**
 * The "How I work best" questions. Worded around what helps, in the person's own words, so nobody is
 * asked to describe themselves as a problem. Used for both the form and the manager's view.
 */
export const PROFILE_QUESTIONS = [
  { key: "strengths", label: "What I bring to the team", hint: "For example: noticing details, keeping calm, getting on with residents, knowing the stock." },
  { key: "helps", label: "What helps me do my best work", hint: "For example: written instructions, knowing who I am working with, a quiet place for my break." },
  { key: "changes", label: "How I like to hear about changes", hint: "For example: in writing, with as much notice as possible, with the reason." },
  { key: "hardDay", label: "On a hard day, it helps if…", hint: "For example: I can step outside for five minutes, or someone checks in with me by message." },
] as const satisfies readonly { key: keyof WorkProfile; label: string; hint: string }[];

export const CONTACT_WAYS: ContactWay[] = ["text", "app", "call", "in_person"];

export const CONTACT_LABEL: Record<ContactWay, string> = {
  text: "Text message",
  app: "A message in VicisRota",
  call: "Phone call",
  in_person: "In person, at work",
};

export const PROFILE_MAX = 600;

/** One line for managers, such as "Text message or in person. Calls only if urgent." */
export const contactSummary = (p: WorkProfile) => {
  const ways = (p.contact ?? []).map((w) => CONTACT_LABEL[w]);
  const first = ways.length ? `${ways.join(" or ")}.` : "";
  return [first, p.avoidCalls ? "Calls only if urgent." : ""].filter(Boolean).join(" ");
};
