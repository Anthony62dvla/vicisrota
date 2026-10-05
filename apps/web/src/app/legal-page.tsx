import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./icons";
import { LEGAL } from "@/lib/legal";

/** The layout for the terms and the privacy policy: plain, readable, with a contents list. */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: { id: string; heading: string; body: ReactNode }[] }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 lg:px-8">
      <Link href="/" className="flex w-fit items-center gap-2.5 rounded-lg">
        <Logo className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-heading">VicisRota</span>
      </Link>
      <h1 className="mt-8 text-3xl font-semibold text-heading">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL.updated}</p>
      <div className="mt-4 text-lg">{intro}</div>
      <nav aria-labelledby="contents-heading" className="mt-6 rounded-xl border border-line bg-surface p-5">
        <h2 id="contents-heading" className="text-sm font-semibold uppercase tracking-wider text-muted">
          Contents
        </h2>
        <ol className="mt-2 grid list-decimal gap-1 pl-6 sm:grid-cols-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-brand underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="mt-10 scroll-mt-4">
          <h2 id={`${s.id}-heading`} className="text-xl font-semibold text-heading">
            {i + 1}. {s.heading}
          </h2>
          <div className="legal mt-3 flex flex-col gap-3 leading-relaxed [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">{s.body}</div>
        </section>
      ))}
      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        VicisRota is run by {LEGAL.company}, {LEGAL.address}. Questions:{" "}
        <a href={`mailto:${LEGAL.email}`} className="underline">
          {LEGAL.email}
        </a>
        . See also the{" "}
        <Link href="/terms" className="underline">
          terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </main>
  );
}
