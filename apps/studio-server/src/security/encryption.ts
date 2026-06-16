// V25 Encryption (Direction G 25/30, orchestrator)
// AES-256-GCM encrypt/decrypt

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;
const TAG_LEN = 16;

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function generateKey(): Buffer {
  return randomBytes(KEY_LEN);
}

export function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  if (key.length !== KEY_LEN) throw new Error("Key must be 32 bytes");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("base64url"), tag: tag.toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): string {
  if (key.length !== KEY_LEN) throw new Error("Key must be 32 bytes");
  const iv = Buffer.from(payload.iv, "base64url");
  const tag = Buffer.from(payload.tag, "base64url");
  const ciphertext = Buffer.from(payload.ciphertext, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptToString(plaintext: string, key: Buffer): string {
  return JSON.stringify(encrypt(plaintext, key));
}

export function decryptFromString(serialized: string, key: Buffer): string {
  return decrypt(JSON.parse(serialized) as EncryptedPayload, key);
}

/** Master metric: encryption strength 0-1. */
export function encryptionStrength(key: Buffer): number {
  return key.length >= KEY_LEN ? 1.0 : key.length / KEY_LEN;
}
