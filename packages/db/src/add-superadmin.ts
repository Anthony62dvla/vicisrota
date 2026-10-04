/**
 * Gives an existing login access to the superadmin area. Run by someone with database access:
 *   DATABASE_URL=... npm run add-superadmin -w @vicisrota/db -- someone@example.com
 * Pass --remove to take access away. Both are written to the superadmin trail.
 */
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { platformAdmin, platformAudit, user } from "./schema";

const url = process.env.DATABASE_URL;
const email = process.argv.find((a) => a.includes("@"))?.trim().toLowerCase();
const remove = process.argv.includes("--remove");
if (!url) throw new Error("DATABASE_URL is not set");
if (!email) throw new Error("Give the email address of an existing login");

const { db, close } = createDb(url);
try {
  const [found] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!found) throw new Error(`No login uses ${email}. They need to sign up first.`);
  if (remove) await db.delete(platformAdmin).where(eq(platformAdmin.userId, found.id));
  else await db.insert(platformAdmin).values({ userId: found.id }).onConflictDoNothing();
  await db.insert(platformAudit).values({ action: remove ? "remove_superadmin" : "add_superadmin", data: { email, from: "command line" } });
  console.log(`${email} ${remove ? "no longer has" : "now has"} superadmin access.`);
} finally {
  await close();
}
