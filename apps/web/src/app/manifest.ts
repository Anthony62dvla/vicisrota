import { BRAND } from "@/lib/brand";
import type { MetadataRoute } from "next";

/** Lets staff add VicisRota to their phone's home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A fixed ID, so phones and app stores treat it as the same app even if the start page changes.
    id: "/",
    name: "VicisRota",
    short_name: "VicisRota",
    description: "Your shifts, time off and clocking in",
    // The dashboard sends staff to their own page and managers to theirs.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    categories: ["business", "productivity"],
    lang: "en-GB",
    background_color: "#ffffff",
    theme_color: BRAND.teal,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
