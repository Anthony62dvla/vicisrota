import { schema } from "@vicisrota/db";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
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
  // Signing up needs the terms box ticked. The email form sends acceptTerms; Microsoft and Google can only make a new
  // account from the sign-up page (see sso.ts), where the buttons wait for the same tick.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.body?.acceptTerms !== true)
        throw new APIError("BAD_REQUEST", { message: "Please tick the box to accept the terms of service." });
    }),
  },
  databaseHooks: {
    user: { create: { before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }) } },
  },
  user: {
    additionalFields: { termsAcceptedAt: { type: "date", required: false, input: false } },
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
