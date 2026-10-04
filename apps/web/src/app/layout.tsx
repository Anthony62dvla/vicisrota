import { BRAND } from "@/lib/brand";
import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
