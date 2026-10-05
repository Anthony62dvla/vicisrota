import { schema } from "@vicisrota/db";
import { langOf, type Lang } from "@vicisrota/messaging";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { auth } from "../auth";
import { db } from "../db";
import { messagesFor } from ".";

/** Remembers the choice on this device too, for pages people see before signing in. */
export const LANG_COOKIE = "vr-lang";

/**
 * The language for this request: the signed-in person's own choice, which follows them to every device,
 * otherwise the choice saved on this device, otherwise English.
 */
export const getLang = cache(async (): Promise<Lang> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    const [row] = await db.select({ language: schema.user.language }).from(schema.user).where(eq(schema.user.id, session.user.id));
    if (row?.language) return langOf(row.language);
  }
  return langOf((await cookies()).get(LANG_COOKIE)?.value);
});

export const getMessages = async () => messagesFor(await getLang());
