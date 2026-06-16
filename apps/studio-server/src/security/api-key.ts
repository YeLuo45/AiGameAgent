// V22 ApiKey (Direction G 22/30, orchestrator)
// Programmatic API key with scoped permissions

import { randomBytes, createHmac } from "node:crypto";

export interface ApiKey {
  id: string;
  keyId: string;
  secretHash: string;
  scopes: string[];
  createdAt: number;
  expiresAt: number | null;
  lastUsedAt: number | null;
  revoked: boolean;
}

export function generateApiKey(scopes: string[] = [], ttlMs: number | null = null): { apiKey: ApiKey; secret: string } {
  const keyId = "ak_" + randomBytes(8).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const secretHash = hashSecret(secret);
  const apiKey: ApiKey = { id: "ak-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), keyId, secretHash, scopes, createdAt: Date.now(), expiresAt: ttlMs ? Date.now() + ttlMs : null, lastUsedAt: null, revoked: false };
  return { apiKey, secret };
}

export function hashSecret(secret: string): string {
  return createHmac("sha256", "aigameagent-static-salt").update(secret).digest("hex");
}

export function verifyApiKey(apiKey: ApiKey, secret: string): boolean {
  if (apiKey.revoked) return false;
  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) return false;
  return hashSecret(secret) === apiKey.secretHash;
}

export function hasScope(apiKey: ApiKey, scope: string): boolean {
  return apiKey.scopes.includes(scope) || apiKey.scopes.includes("*");
}

export function markUsed(apiKey: ApiKey, now: number = Date.now()): ApiKey {
  return { ...apiKey, lastUsedAt: now };
}

export function revokeKey(apiKey: ApiKey): ApiKey {
  return { ...apiKey, revoked: true };
}

export function isExpired(apiKey: ApiKey, now: number = Date.now()): boolean {
  return apiKey.expiresAt !== null && apiKey.expiresAt <= now;
}

/** Master metric: key liveness 0-1. */
export function keyLiveness(apiKey: ApiKey, now: number = Date.now()): number {
  if (apiKey.revoked) return 0;
  if (isExpired(apiKey, now)) return 0;
  return 1;
}
