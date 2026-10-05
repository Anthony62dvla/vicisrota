import type { Lang } from "@vicisrota/messaging";
import { cy } from "./cy";
import { en, type Messages } from "./en";
import { pl } from "./pl";
import { ro } from "./ro";

export type { Messages };
export const MESSAGES: Record<Lang, Messages> = { en, cy, pl, ro };
export const messagesFor = (lang: Lang) => MESSAGES[lang];
