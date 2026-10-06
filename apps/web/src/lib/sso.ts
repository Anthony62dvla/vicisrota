/**
 * Signing in with a Microsoft or Google account. Each is switched on by adding its client ID and secret
 * to app.env; with neither set, only email and password sign-in shows.
 */
export type SsoProvider = { id: "microsoft" | "google"; label: string };

const env = (name: string) => process.env[name]?.trim() || undefined;

export const socialProviders = () => ({
  ...(env("MICROSOFT_CLIENT_ID") && env("MICROSOFT_CLIENT_SECRET")
    ? {
        microsoft: {
          clientId: env("MICROSOFT_CLIENT_ID")!,
          clientSecret: env("MICROSOFT_CLIENT_SECRET")!,
          // "common" lets both work and personal Microsoft accounts in; a business can be pinned to one tenant.
          tenantId: env("MICROSOFT_TENANT_ID") ?? "common",
          authority: env("MICROSOFT_AUTHORITY"),
          disableProfilePhoto: true,
          // New accounts are only made from the sign-up page, after the terms box is ticked.
          disableImplicitSignUp: true,
        },
      }
    : {}),
  ...(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")
    ? { google: { clientId: env("GOOGLE_CLIENT_ID")!, clientSecret: env("GOOGLE_CLIENT_SECRET")!, disableImplicitSignUp: true } }
    : {}),
});

/** The providers that are switched on, in the order they show on the sign-in page. */
export const ssoProviders = (): SsoProvider[] => {
  const on = socialProviders();
  return [
    ...("microsoft" in on ? [{ id: "microsoft" as const, label: "Microsoft" }] : []),
    ...("google" in on ? [{ id: "google" as const, label: "Google" }] : []),
  ];
};

/** What went wrong, in plain words, from the error code the sign-in comes back with. */
export const ssoErrorMessage = (code: string | undefined): string | null => {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === "two_step_on")
    return "You have two-step sign-in turned on, so please sign in with your email, password and code. This keeps the extra check in place.";
  if (c === "password_only") return "This account signs in with email and password only.";
  if (c === "account_not_linked")
    return "There is already an account with that email. Sign in with your email and password, then link your Microsoft or Google account from Sign-in security.";
  if (c === "signup_disabled")
    return "There is no VicisRota account for that email yet. Please create one on the sign-up page first.";
  if (c === "email_not_found")
    return "Your Microsoft or Google account did not share an email address, so we could not sign you in. Please use your email and password.";
  return "That did not work. Please try again, or sign in with your email and password.";
};
