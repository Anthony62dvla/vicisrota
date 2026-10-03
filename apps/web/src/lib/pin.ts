import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** Wrong PINs allowed before the PIN is locked, and for how long. */
export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MINUTES = 15;

/** 4 to 6 digits, and not one anyone would guess first (0000, 1234, 4321). */
export const pinProblem = (pin: string): string | null => {
  if (!/^\d{4,6}$/.test(pin)) return "Use 4 to 6 numbers.";
  const d = [...pin].map(Number);
  const same = d.every((x) => x === d[0]);
  const up = d.every((x, i) => i === 0 || x === d[i - 1]! + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1]! - 1);
  return same || up || down ? "That PIN is too easy to guess. Choose another." : null;
};

export const hashPin = async (pin: string) => {
  const salt = randomBytes(16);
  const key = await scryptAsync(pin, salt, 32);
  return `scrypt:${salt.toString("base64")}:${key.toString("base64")}`;
};

export const verifyPin = async (pin: string, stored: string) => {
  const [scheme, salt, key] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(pin, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
};
