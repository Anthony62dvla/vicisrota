"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isActive, showsMenu, type Nav, type NavItem } from "@/lib/nav";
import { switchBusiness } from "./actions";
import { SignOutButton } from "./dashboard/sign-out";
import { Icon, Logo } from "./icons";

/**
 * The app layout: a calm header, a menu down the side on larger screens and a short bar along the bottom
 * on phones, with everything else one tap away under "More". The current page is marked in words for
 * screen readers (aria-current) as well as in colour.
 */
export function AppFrame({ nav, children }: { nav: Nav | null; children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    // Close the menu after moving to another page.
    setLastPath(pathname);
    setMoreOpen(false);
  }

  if (!nav || !showsMenu(pathname)) {
    return (
      <>
        <div className="flex-1">{children}</div>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-sm text-muted lg:px-8">
          <Link href="/display" className="underline">
            Display settings
          </Link>
        </footer>
      </>
    );
  }

  const inBar = nav.phoneBar.some((i) => isActive(pathname, i));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Link href={nav.phoneBar[0]!.href} className="flex items-center gap-2.5 rounded-lg">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight text-heading">VicisRota</span>
          </Link>
          <span aria-hidden className="hidden h-6 w-px bg-line sm:block" />
          {nav.businesses.length > 1 ? (
            <BusinessSwitcher nav={nav} className="hidden sm:block" />
          ) : (
            <span className="hidden truncate text-muted sm:block">{nav.businessName}</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted md:block">{nav.userName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav
          aria-label="Main"
          className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-4 md:block"
        >
          <MenuSections nav={nav} pathname={pathname} />
        </nav>
        <div id="content" className="min-w-0 flex-1 pb-24 md:pb-8">
          {children}
        </div>
      </div>

      {/* Phone menu */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface md:hidden">
        <ul className="grid grid-cols-5">
          {nav.phoneBar.map((item) => (
            <li key={item.href}>
              <BarLink item={item} active={isActive(pathname, item)} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls="more-menu"
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-xs ${!inBar ? "font-semibold text-brand" : "text-muted"}`}
            >
              <Icon name="more" className="h-6 w-6" />
              More
            </button>
          </li>
        </ul>
      </nav>
      {moreOpen && <MoreSheet nav={nav} pathname={pathname} onClose={() => setMoreOpen(false)} />}
    </div>
  );
}

function MenuSections({ nav, pathname }: { nav: Nav; pathname: string }) {
  return (
    <div className="flex flex-col gap-5">
      {nav.sections.map((section, i) => (
        <div key={section.title ?? `s${i}`}>
          {section.title && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{section.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      active ? "bg-brand-soft font-semibold text-brand" : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Icon name={item.icon} className={`h-5 w-5 shrink-0 ${active ? "text-brand" : "text-muted"}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-col items-center gap-0.5 py-2 text-center text-xs ${active ? "font-semibold text-brand" : "text-muted"}`}
    >
      <Icon name={item.icon} className="h-6 w-6" />
      <span className="max-w-full truncate px-1">{item.label}</span>
    </Link>
  );
}

function MoreSheet({ nav, pathname, onClose }: { nav: Nav; pathname: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      id="more-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-40 overflow-y-auto bg-surface px-3 pb-24 pt-4 md:hidden"
    >
      <div className="mb-4 flex items-center justify-between px-3">
        {nav.businesses.length > 1 ? <BusinessSwitcher nav={nav} /> : <p className="font-semibold text-heading">{nav.businessName}</p>}
        <button ref={closeRef} type="button" onClick={onClose} className="flex items-center gap-1 rounded-lg border border-zinc-400 px-3 py-1.5">
          <Icon name="close" className="h-4 w-4" />
          Close
        </button>
      </div>
      <MenuSections nav={nav} pathname={pathname} />
    </div>
  );
}

/** For people who belong to more than one business: shows the one open now and lets them move to another. */
function BusinessSwitcher({ nav, className = "" }: { nav: Nav; className?: string }) {
  return (
    <details className={`relative ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-heading hover:bg-brand-soft">
        <span className="max-w-48 truncate">{nav.businessName}</span>
        <span aria-hidden className="text-xs text-muted">▾</span>
        <span className="sr-only">, switch business</span>
      </summary>
      <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg">
        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted">Your businesses</p>
        <ul>
          {nav.businesses.map((b) => (
            <li key={b.id}>
              {b.current ? (
                <p aria-current="true" className="flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2 font-medium text-heading">
                  {b.name}
                  <Icon name="check" className="h-4 w-4" />
                </p>
              ) : (
                <form action={switchBusiness}>
                  <input type="hidden" name="organisationId" value={b.id} />
                  <button type="submit" className="w-full rounded-lg px-3 py-2 text-left hover:bg-brand-soft">
                    {b.name}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
