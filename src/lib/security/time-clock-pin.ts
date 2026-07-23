import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PIN_PATTERN = /^\d{4,12}$/;

export function validateTimeClockPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("El PIN debe contener de 4 a 12 digitos");
  }
  return pin;
}

export async function hashTimeClockPin(pin: string) {
  validateTimeClockPin(pin);
  const salt = randomBytes(16);
  const derived = (await scrypt(pin, salt, 32)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyTimeClockPin(pin: string, encoded: string | null | undefined) {
  if (!PIN_PATTERN.test(pin) || !encoded) {
    return false;
  }
  const [scheme, saltHex, hashHex] = encoded.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = (await scrypt(pin, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
