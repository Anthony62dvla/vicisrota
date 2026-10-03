import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VicisRota",
  description: "UK staff scheduling with employment law built in",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
