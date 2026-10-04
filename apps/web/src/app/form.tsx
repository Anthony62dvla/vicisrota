import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Logo } from "./icons";

// Shared form pieces: one question per field, visible labels, errors announced to screen readers.

export function FormShell({
  title,
  error,
  action,
  children,
}: {
  title: string;
  error?: string | null;
  action: (form: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
        <Logo className="h-10 w-10" />
        <span className="text-xl font-semibold tracking-tight text-heading">VicisRota</span>
      </Link>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <form action={action} className="mt-6 flex flex-col gap-4">
          {error && (
            <p role="alert" className="rounded-lg border border-red-400 bg-red-50 p-3 dark:bg-red-950">
              {error}
            </p>
          )}
          {children}
        </form>
      </div>
    </main>
  );
}

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <input required {...input} className="rounded-lg border border-zinc-400 px-3 py-2.5 text-base" />
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-hover disabled:opacity-60">
      {pending ? "Please wait…" : children}
    </button>
  );
}
