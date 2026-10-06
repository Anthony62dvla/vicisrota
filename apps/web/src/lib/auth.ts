import { schema } from "@vicisrota/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { socialProviders } from "./sso";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, twoFactor: schema.twoFactor },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  // Microsoft and Google, each only when its keys are in app.env. Accounts are never joined up automatically by
  // email: someone with a password links their Microsoft or Google account themselves, while signed in.
  socialProviders: socialProviders(),
  user: {
    validateUserInfo: async ({ user, source }) => {
      if (!source.oauth || !user.email) return;
      // Two-step sign-in is only checked for passwords, so people who turned it on (and the superadmin) keep using it.
      const [existing] = await db
        .select({ id: schema.user.id, twoFactorEnabled: schema.user.twoFactorEnabled })
        .from(schema.user)
        .where(eq(sql`lower(${schema.user.email})`, user.email.toLowerCase()));
      if (!existing) return;
      const superadmin = await db.select({ id: schema.platformAdmin.userId }).from(schema.platformAdmin).where(eq(schema.platformAdmin.userId, existing.id));
      if (superadmin.length) return { error: "password_only" };
      if (existing.twoFactorEnabled) return { error: "two_step_on" };
    },
  },
  // Two-step sign-in with an authenticator app, plus single-use backup codes. nextCookies must stay last.
  plugins: [twoFactor({ issuer: "VicisRota" }), nextCookies()],
});

/** The signed-in user, or a redirect to sign in. */
export const requireUser = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user;
};
