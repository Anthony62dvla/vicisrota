"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const input = "rounded-lg border border-zinc-400 px-3 py-2 text-base";
const button = "self-start rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover disabled:opacity-60";

type Setup = { qr: string; secret: string; backupCodes: string[] };

function Codes({ list }: { list: string[] }) {
  return (
    <div className="mt-3 rounded-lg border-2 border-amber-500 p-4">
      <p className="font-medium">Your backup codes</p>
      <p className="mt-1 text-sm">
        If you lose your phone, each of these lets you sign in once. Save them somewhere safe, such as a password manager, or print them. They will not be shown
        again.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1 font-mono">
        {list.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** Turns two-step sign-in on (scan, save backup codes, confirm a code) or off, and replaces backup codes. */
export function TwoStepSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  };

  const start = (form: FormData) =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.enable({ password: String(form.get("password") ?? "") });
      if (error || !data || !("totpURI" in data) || !data.totpURI) return setError("That password is not right. Please try again.");
      const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
      setSetup({ qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 }), secret, backupCodes: data.backupCodes ?? [] });
    });

  const confirm = (form: FormData) =>
    run(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({ code: String(form.get("code") ?? "").replace(/\s/g, "") });
      if (error) return setError("That code did not work. Use the code showing in your app now, and check the time on your phone is right.");
      setSetup(null);
      setDone("Two-step sign-in is on. Next time you sign in, you will be asked for a code from your app.");
      router.refresh();
    });

  const turnOff = (form: FormData) =>
    run(async () => {
      const { error } = await authClient.twoFactor.disable({ password: String(form.get("password") ?? "") });
      if (error) return setError("That password is not right. Please try again.");
      setDone("Two-step sign-in is off. Signing in now needs only your password.");
      router.refresh();
    });

  const newCodes = (form: FormData) =>
    run(async () => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: String(form.get("password") ?? "") });
      if (error || !data) return setError("That password is not right. Please try again.");
      setCodes(data.backupCodes);
    });

  return (
    <div className="mt-4 flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg border border-red-400 p-3">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-lg border border-green-600 p-3">
          {done}
        </p>
      )}
      {setup ? (
        <div className="flex flex-col gap-3">
          <p className="font-medium">1. Scan this with your authenticator app</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, not a remote image */}
          <img src={setup.qr} alt="QR code to add VicisRota to your authenticator app" width={220} height={220} className="rounded border border-line" />
          <p className="text-sm">
            Can&apos;t scan it? Type this key into the app instead: <span className="font-mono break-all">{setup.secret}</span>
          </p>
          <p className="font-medium">2. Save your backup codes</p>
          <Codes list={setup.backupCodes} />
          <form action={confirm} className="flex flex-col gap-3">
            <label className="flex max-w-xs flex-col gap-1">
              <span className="font-medium">3. Type the 6-digit code from your app</span>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className={input} />
            </label>
            <button type="submit" disabled={pending} className={button}>
              {pending ? "Checking…" : "Turn on two-step sign-in"}
            </button>
          </form>
        </div>
      ) : enabled ? (
        <>
          <p className="font-medium">Two-step sign-in is on.</p>
          <form action={newCodes} className="flex max-w-xs flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Your password</span>
              <input name="password" type="password" autoComplete="current-password" required className={input} />
            </label>
            <button type="submit" disabled={pending} className={button}>
              Get new backup codes
            </button>
          </form>
          {codes && <Codes list={codes} />}
          <form action={turnOff} className="flex max-w-xs flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium">Your password</span>
              <input name="password" type="password" autoComplete="current-password" required className={input} />
            </label>
            <button type="submit" disabled={pending} className="self-start rounded-lg border border-zinc-400 px-4 py-2">
              Turn off two-step sign-in
            </button>
          </form>
        </>
      ) : (
        <form action={start} className="flex max-w-xs flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Your password</span>
            <input name="password" type="password" autoComplete="current-password" required className={input} />
          </label>
          <button type="submit" disabled={pending} className={button}>
            {pending ? "Please wait…" : "Set up two-step sign-in"}
          </button>
        </form>
      )}
    </div>
  );
}
