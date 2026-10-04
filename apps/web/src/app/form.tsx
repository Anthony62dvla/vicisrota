import type { InputHTMLAttributes, ReactNode } from "react";

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
      <h1 className="text-2xl font-semibold">{title}</h1>
      <form action={action} className="mt-6 flex flex-col gap-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-400 p-3">
            {error}
          </p>
        )}
        {children}
      </form>
    </main>
  );
}

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">{label}</span>
      <input required {...input} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
      {pending ? "Please wait…" : children}
    </button>
  );
}
