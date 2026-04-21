import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, keyHex] = hash.split(":");
  if (!salt || !keyHex) return false;

  const key = (await scrypt(password, salt, 64)) as Buffer;
  const original = Buffer.from(keyHex, "hex");

  if (original.length !== key.length) return false;
  return timingSafeEqual(original, key);
}
