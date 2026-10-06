import { ssoErrorMessage, ssoProviders } from "@/lib/sso";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { error } = await searchParams;
  return <SignUpForm providers={ssoProviders()} initialError={ssoErrorMessage(typeof error === "string" ? error : undefined)} />;
}
