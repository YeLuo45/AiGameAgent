// V26 KeyManager (Direction G 26/30, orchestrator)
// Encryption key lifecycle (issue / rotate / revoke)

import { generateKey, type EncryptedPayload, encrypt } from "./encryption.js";

export type KeyStatus = "active" | "rotating" | "revoked";

export interface ManagedKey {
  id: string;
  key: Buffer;
  status: KeyStatus;
  createdAt: number;
  expiresAt: number | null;
  /** Previous key ID (for rotation). */
  previousId: string | null;
  /** Use count. */
  useCount: number;
}

export interface KeyManagerState {
  keys: Record<string, ManagedKey>;
  activeId: string | null;
  nextId: number;
}

export function createKeyManagerState(): KeyManagerState {
  return { keys: {}, activeId: null, nextId: 1 };
}

export function issueKey(state: KeyManagerState, ttlMs: number | null = null): KeyManagerState {
  const id = `key-${state.nextId}`;
  const key = generateKey();
  const now = Date.now();
  const managed: ManagedKey = { id, key, status: "active", createdAt: now, expiresAt: ttlMs ? now + ttlMs : null, previousId: state.activeId, useCount: 0 };
  return { ...state, keys: { ...state.keys, [id]: managed }, activeId: id, nextId: state.nextId + 1 };
}

export function getActiveKey(state: KeyManagerState): ManagedKey | undefined {
  return state.activeId ? state.keys[state.activeId] : undefined;
}

export function rotateKey(state: KeyManagerState, ttlMs: number | null = null): KeyManagerState {
  // Mark current as rotating
  const current = state.activeId ? state.keys[state.activeId] : null;
  let next = state;
  if (current) next = { ...next, keys: { ...next.keys, [current.id]: { ...current, status: "rotating" } } };
  // Issue new
  next = issueKey(next, ttlMs);
  return next;
}

export function revokeKey(state: KeyManagerState, id: string): KeyManagerState {
  const k = state.keys[id];
  if (!k) return state;
  return { ...state, keys: { ...state.keys, [id]: { ...k, status: "revoked" } }, activeId: state.activeId === id ? null : state.activeId };
}

export function incrementUse(state: KeyManagerState, id: string): KeyManagerState {
  const k = state.keys[id];
  if (!k) return state;
  return { ...state, keys: { ...state.keys, [id]: { ...k, useCount: k.useCount + 1 } } };
}

export function encryptWithActive(state: KeyManagerState, plaintext: string): EncryptedPayload | null {
  const k = getActiveKey(state);
  if (!k) return null;
  return encrypt(plaintext, k.key);
}

export function listKeys(state: KeyManagerState, status?: KeyStatus): ManagedKey[] {
  let arr = Object.values(state.keys);
  if (status) arr = arr.filter((k) => k.status === status);
  return arr;
}

/** Master metric: key rotation health 0-1. */
export function rotationHealth(state: KeyManagerState): number {
  const total = Object.keys(state.keys).length;
  if (total === 0) return 1.0;
  const active = listKeys(state, "active").length;
  return active / total;
}
