"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

/**
 * Shown when the phone has no signal and this page is the copy saved on the phone.
 * Buttons on the page need a signal, so it says what still works and how to get help.
 */
export function OfflineNotice({ updatedAt }: { updatedAt: string }) {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (!offline) return null;
  return (
    <div role="status" className="mt-6 rounded-lg border-2 border-amber-600 p-4">
      <p className="font-medium">No signal. This is your rota as it was at {updatedAt}.</p>
      <p className="mt-1">Clocking in, check-ins and requests will work again when you have signal.</p>
      <p className="mt-2 font-medium">If you are working alone and need help urgently, phone your manager or call 999.</p>
    </div>
  );
}
