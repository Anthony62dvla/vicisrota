import { BRAND } from "@/lib/brand";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { DISPLAY_COOKIE, parseDisplay } from "@/lib/display";
import "./globals.css";
import { ServiceWorker } from "./service-worker";

export const metadata: Metadata = {
  title: "VicisRota",
  description: "UK staff scheduling with employment law built in",
  appleWebApp: { capable: true, title: "VicisRota", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: BRAND.teal,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const display = parseDisplay((await cookies()).get(DISPLAY_COOKIE)?.value);
  const flags = Object.fromEntries(display.map((k) => [`data-${k}`, ""]));
  return (
    <html lang="en-GB" className="h-full antialiased" {...flags}>
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="mx-auto w-full max-w-3xl px-4 pb-6 text-sm">
          <Link href="/display" className="underline">Display settings</Link>
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
