// V18 PasswordHasher (Direction G 18/30, generic-agent)
// PBKDF2-like hashing (pure Node crypto)

import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;
const ITERATIONS = 100_000;
const DIGEST = "sha256";

export interface HashedPassword {
  hash: string;
  salt: string;
  iterations: number;
  digest: string;
}

export function hashPassword(password: string, iterations: number = ITERATIONS): HashedPassword {
  const salt = randomBytes(SALT_LEN).toString("base64url");
  const hash = pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST).toString("base64url");
  return { hash, salt, iterations, digest: DIGEST };
}

export function verifyPassword(password: string, stored: HashedPassword): boolean {
  const candidate = pbkdf2Sync(password, stored.salt, stored.iterations, KEY_LEN, stored.digest);
  const expected = Buffer.from(stored.hash, "base64url");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function isStrongPassword(password: string, opts: { minLength?: number } = {}): boolean {
  const minLength = opts.minLength ?? 8;
  if (password.length < minLength) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

/** Master metric: hash strength 0-1 (iteration count normalized). */
export function hashStrength(stored: HashedPassword): number {
  return Math.min(1, stored.iterations / 200_000);
}
