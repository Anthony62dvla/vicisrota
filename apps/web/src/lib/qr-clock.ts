import { createHmac, timingSafeEqual } from "node:crypto";
import { schema } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "./db";
import { appUrl } from "./sms";

/** The clock-in tablet shows a new code every 30 seconds, so a photo of it soon stops working. */
export const QR_WINDOW_MS = 30_000;
/** How many windows old a code may be: long enough to scan, sign in and tap Clock in (up to 2 minutes). */
const QR_GRACE_WINDOWS = 4;

type Device = { id: string; tokenHash: string };

const windowAt = (now: number) => Math.floor(now / QR_WINDOW_MS);

// Keyed by the server secret and the tablet's own token, so only the server can make a valid code.
const sign = (device: Device, window: number) =>
  createHmac("sha256", `${process.env.BETTER_AUTH_SECRET ?? ""}:${device.tokenHash}`).update(`${device.id}.${window}`).digest("base64url").slice(0, 22);

/** The link shown as a QR code on the tablet right now, as an SVG, and when it changes. */
export const tabletQr = async (device: Device, now = Date.now()) => {
  const window = windowAt(now);
  const url = appUrl(`/clock?k=${device.id}&w=${window}&s=${sign(device, window)}`);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { svg, changesAt: (window + 1) * QR_WINDOW_MS };
};

/** A printable code for a workplace with no tablet. It opens the phone clock-in, which checks location as usual. */
export const posterQr = () => QRCode.toString(appUrl("/me"), { type: "svg", margin: 1, errorCorrectionLevel: "M" });

/** The tablet a scanned code came from, if the code is genuine, recent and the tablet is still set up. */
export const scannedTablet = async (code: { k: string; w: string; s: string }, now = Date.now()) => {
  const window = Number(code.w);
  if (!/^[0-9a-f-]{36}$/.test(code.k) || !Number.isInteger(window) || typeof code.s !== "string") return { error: "invalid" as const };
  const age = windowAt(now) - window;
  if (age < 0 || age > QR_GRACE_WINDOWS) return { error: "expired" as const };
  const [device] = await db
    .select()
    .from(schema.kioskDevice)
    .where(and(eq(schema.kioskDevice.id, code.k), isNull(schema.kioskDevice.revokedAt)));
  if (!device) return { error: "invalid" as const };
  const expected = Buffer.from(sign(device, window));
  const given = Buffer.from(code.s);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { error: "invalid" as const };
  return { device };
};
