import { ssoErrorMessage, ssoProviders } from "@/lib/sso";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { error } = await searchParams;
  return <SignInForm providers={ssoProviders()} initialError={ssoErrorMessage(typeof error === "string" ? error : undefined)} />;
}
