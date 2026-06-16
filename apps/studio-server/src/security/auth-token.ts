// V16 AuthToken (Direction G 16/30, generic-agent)
// Token issue/verify with HMAC-like signature (pure, no crypto)

import { createHmac, randomBytes } from "node:crypto";

export interface TokenPayload {
  sub: string;
  /** Expiry timestamp ms. */
  exp: number;
  /** Issued at. */
  iat: number;
  /** Custom claims. */
  claims: Record<string, unknown>;
}

export interface AuthToken {
  token: string;
  payload: TokenPayload;
}

const SEP = ".";

export function issueToken(payload: TokenPayload, secret: string): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const sig = sign(encoded, secret);
  return `${encoded}${SEP}${sig}`;
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  const idx = token.indexOf(SEP);
  if (idx < 0) return null;
  const encoded = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (sign(encoded, secret) !== sig) return null;
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  try {
    const payload = JSON.parse(json) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createPayload(sub: string, ttlMs: number, claims: Record<string, unknown> = {}): TokenPayload {
  const now = Date.now();
  return { sub, exp: now + ttlMs, iat: now, claims };
}

export function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

/** Master metric: token validity rate 0-1. */
export function tokenValidityRate(tokens: string[], secret: string): number {
  if (tokens.length === 0) return 1.0;
  return tokens.filter((t) => verifyToken(t, secret) !== null).length / tokens.length;
}
