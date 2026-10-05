"use client";

import { useEffect, useState } from "react";
import { kioskQrCode } from "./actions";

/** A QR code staff scan with their own phone to clock in, instead of using a PIN. It changes every 30 seconds. */
export function KioskQr() {
  const [code, setCode] = useState<{ svg: string; changesAt: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const next = await kioskQrCode().catch(() => null);
      setCode(next);
      timer = setTimeout(load, next ? Math.max(next.changesAt - Date.now(), 1000) + 250 : 15_000);
    };
    load();
    return () => clearTimeout(timer);
  }, []);
  if (!code) return null;
  return (
    <section aria-labelledby="qr-heading" className="mt-8 flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface p-5">
      <div
        role="img"
        aria-label="QR code for clocking in with your phone"
        className="h-48 w-48 shrink-0 rounded-lg bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: code.svg }}
      />
      <div className="max-w-sm">
        <h2 id="qr-heading" className="text-xl font-semibold">Or scan with your phone</h2>
        <p className="mt-2 text-lg">Point your phone&rsquo;s camera at the code, then choose Clock in. No PIN needed.</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">The code changes every 30 seconds, so it only works here.</p>
      </div>
    </section>
  );
}
