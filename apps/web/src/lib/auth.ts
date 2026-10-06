import { schema } from "@vicisrota/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, twoFactor: schema.twoFactor },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  // Two-step sign-in with an authenticator app, plus single-use backup codes. nextCookies must stay last.
  plugins: [twoFactor({ issuer: "VicisRota" }), nextCookies()],
});

/** The signed-in user, or a redirect to sign in. */
export const requireUser = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user;
};
