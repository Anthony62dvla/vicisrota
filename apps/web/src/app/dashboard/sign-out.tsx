"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { clearSavedPages } from "@/lib/offline";
import { Icon } from "../icons";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        // Forget the saved copy of their page first, in case someone else uses this phone next.
        await clearSavedPages();
        await authClient.signOut();
        router.push("/sign-in");
      }}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <Icon name="signOut" className="h-4 w-4" />
      {label}
    </button>
  );
}
