import { createHash, randomBytes } from "node:crypto";

export function generateResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiryDate(minutes = 30) {
  const now = Date.now();
  return new Date(now + minutes * 60 * 1000);
}

export function toMySqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
