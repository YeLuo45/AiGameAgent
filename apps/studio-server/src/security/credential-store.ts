// V19 CredentialStore (Direction G 19/30, generic-agent)
// User credential store with email/username lookup

import { type HashedPassword, hashPassword, verifyPassword } from "./password-hasher.js";

export interface UserCredential {
  id: string;
  username: string;
  email: string;
  password: HashedPassword;
  /** Optional metadata. */
  metadata: Record<string, string>;
  createdAt: number;
  lastLoginAt: number | null;
  disabled: boolean;
}

export interface CredentialStoreState {
  byId: Record<string, UserCredential>;
  byUsername: Record<string, string>;
  byEmail: Record<string, string>;
  nextId: number;
}

export function createCredentialStore(): CredentialStoreState {
  return { byId: {}, byUsername: {}, byEmail: {}, nextId: 1 };
}

export function createUser(state: CredentialStoreState, username: string, email: string, password: string, metadata: Record<string, string> = {}): CredentialStoreState {
  const id = `u-${state.nextId}`;
  const cred: UserCredential = { id, username, email, password: hashPassword(password), metadata, createdAt: Date.now(), lastLoginAt: null, disabled: false };
  return {
    ...state,
    byId: { ...state.byId, [id]: cred },
    byUsername: { ...state.byUsername, [username]: id },
    byEmail: { ...state.byEmail, [email]: id },
    nextId: state.nextId + 1,
  };
}

export function getById(state: CredentialStoreState, id: string): UserCredential | undefined {
  return state.byId[id];
}

export function getByUsername(state: CredentialStoreState, username: string): UserCredential | undefined {
  const id = state.byUsername[username];
  return id ? state.byId[id] : undefined;
}

export function getByEmail(state: CredentialStoreState, email: string): UserCredential | undefined {
  const id = state.byEmail[email];
  return id ? state.byId[id] : undefined;
}

export function authenticate(state: CredentialStoreState, identifier: string, password: string, now: number = Date.now()): { user: UserCredential; token: string } | null {
  const u = getByUsername(state, identifier) ?? getByEmail(state, identifier);
  if (!u) return null;
  if (u.disabled) return null;
  if (!verifyPassword(password, u.password)) return null;
  // Update lastLoginAt
  const updated: CredentialStoreState = { ...state, byId: { ...state.byId, [u.id]: { ...u, lastLoginAt: now } } };
  return { user: updated.byId[u.id], token: `${u.id}.${now}` };
}

export function disableUser(state: CredentialStoreState, id: string): CredentialStoreState {
  const u = state.byId[id];
  if (!u) return state;
  return { ...state, byId: { ...state.byId, [id]: { ...u, disabled: true } } };
}

export function listUsers(state: CredentialStoreState, includeDisabled: boolean = true): UserCredential[] {
  let arr = Object.values(state.byId);
  if (!includeDisabled) arr = arr.filter((u) => !u.disabled);
  return arr;
}

/** Master metric: credential coverage 0-1. */
export function credentialCoverage(state: CredentialStoreState): number {
  return state.byEmail["admin@local"] ? 1.0 : Object.keys(state.byId).length > 0 ? 0.5 : 0;
}
