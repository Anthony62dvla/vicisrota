"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps staff's own shifts readable with no signal. */
export function ServiceWorker() {
  useEffect(() => {
    // Only in a real build: in development it would serve stale code while editing.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Without it the app still works; it just cannot show saved shifts offline.
    });
  }, []);
  return null;
}
