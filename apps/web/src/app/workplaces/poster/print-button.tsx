"use client";

export function PrintButton({ label = "Print poster" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover print:hidden">
      {label}
    </button>
  );
}
