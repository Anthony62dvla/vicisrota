"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { clearSavedPages } from "@/lib/offline";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        // Forget the saved copy of their page first, in case someone else uses this phone next.
        await clearSavedPages();
        await authClient.signOut();
        router.push("/sign-in");
      }}
      className="rounded-lg border border-zinc-400 px-3 py-1"
    >
      Sign out
    </button>
  );
}
