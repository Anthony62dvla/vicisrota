"use client";

import { useEffect, useState } from "react";
import { removePushDevice, savePushDevice, sendTestNotification } from "./actions";

type Status = "checking" | "unsupported" | "iphone-install" | "blocked" | "off" | "on";

const toBytes = (base64url: string) => {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const registration = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

const currentStatus = async (): Promise<Status> => {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // iPhones only allow notifications once VicisRota is on the Home Screen.
    const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return iphone ? "iphone-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const existing = await (await registration()).pushManager.getSubscription();
  return existing && Notification.permission === "granted" ? "on" : "off";
};

/**
 * Turns app notifications on or off for this phone or computer. They are free, so people who use them
 * do not need texts. Each device is turned on separately, by the person, and they can turn it off here.
 */
export function PushSwitch({ publicKey }: { publicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    currentStatus()
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus("unsupported"));
    return () => {
      live = false;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(publicKey) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { ok } = await savePushDevice({ endpoint: json.endpoint, keys: json.keys });
      if (!ok) {
        await sub.unsubscribe();
        setMessage("This browser's notifications could not be set up. Try Chrome, Safari, Edge or Firefox.");
        return;
      }
      setStatus("on");
      setMessage("Notifications are on for this device.");
    } catch {
      setMessage("Notifications could not be turned on. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await removePushDevice(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setMessage("Notifications are off for this device.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const { sent } = await sendTestNotification();
      setMessage(sent ? "Test sent. It should appear in a few seconds." : "The test could not be sent. Try turning notifications off and on again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border p-4">
      <p className="font-medium">App notifications on this device</p>
      {status === "checking" && <p className="mt-1 text-muted">Checking…</p>}
      {status === "unsupported" && <p className="mt-1">This browser cannot show notifications. Chrome, Safari, Edge and Firefox can.</p>}
      {status === "iphone-install" && (
        <p className="mt-1">
          On an iPhone, first put VicisRota on your Home Screen (see &ldquo;Put VicisRota on your phone&rdquo; below). Then open it from the Home Screen and
          come back here.
        </p>
      )}
      {status === "blocked" && (
        <p className="mt-1">
          Notifications are blocked for VicisRota in this browser. To allow them, open the browser&rsquo;s settings for this site and change
          Notifications to Allow, then come back here.
        </p>
      )}
      {status === "off" && (
        <>
          <p className="mt-1">Free, and they arrive like a text. Your phone will ask if you want to allow them.</p>
          <button type="button" onClick={turnOn} disabled={busy} className="mt-3 rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60">
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}
      {status === "on" && (
        <>
          <p className="mt-1">On. Rota changes and the reminders you choose below will arrive here.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={test} disabled={busy} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
              Send me a test
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className="rounded-lg border border-zinc-400 px-4 py-2 disabled:opacity-60">
              Turn off on this device
            </button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
    </div>
  );
}
