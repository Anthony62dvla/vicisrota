"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Server errors carry a digest that matches the server log; browser errors get a fresh reference.
  const pathname = usePathname();
  const [reference] = useState(() => error.digest ?? crypto.randomUUID().slice(0, 8).toUpperCase());

  useEffect(() => {
    Sentry.captureException(error, { tags: { reference } });
  }, [error, reference]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-3">Your work has not been lost. Please try again.</p>
      {reference && (
        <p className="mt-3">
          If it keeps happening, please{" "}
          <Link href={`/help?${new URLSearchParams({ ref: reference, from: pathname })}`} className="underline">
            report the problem
          </Link>
          . Reference <strong className="font-mono">{reference}</strong> is filled in for you.
        </p>
      )}
      <button onClick={() => retry()} className="mt-6 rounded-lg border border-zinc-400 px-4 py-2">
        Try again
      </button>
    </main>
  );
}
