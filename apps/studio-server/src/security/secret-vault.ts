// V27 SecretVault (Direction G 27/30, orchestrator)
// Secure secret storage (encrypted at rest, indexed)

import { type EncryptedPayload, generateKey, encrypt, decrypt } from "./encryption.js";

export interface SecretEntry {
  id: string;
  name: string;
  ciphertext: EncryptedPayload;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface SecretVaultState {
  secrets: Record<string, SecretEntry>;
  byName: Record<string, string>;
  masterKey: Buffer;
  nextId: number;
}

export function createSecretVault(): SecretVaultState {
  return { secrets: {}, byName: {}, masterKey: generateKey(), nextId: 1 };
}

export function setSecret(state: SecretVaultState, name: string, value: string): SecretVaultState {
  const id = state.byName[name] ?? `s-${state.nextId}`;
  const ciphertext = encrypt(value, state.masterKey);
  const now = Date.now();
  const existing = state.secrets[id];
  const entry: SecretEntry = {
    id,
    name,
    ciphertext,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    version: (existing?.version ?? 0) + 1,
  };
  return { ...state, secrets: { ...state.secrets, [id]: entry }, byName: { ...state.byName, [name]: id }, nextId: state.nextId + 1 };
}

export function getSecret(state: SecretVaultState, name: string): string | null {
  const id = state.byName[name];
  if (!id) return null;
  const entry = state.secrets[id];
  if (!entry) return null;
  return decrypt(entry.ciphertext, state.masterKey);
}

export function deleteSecret(state: SecretVaultState, name: string): SecretVaultState {
  const id = state.byName[name];
  if (!id) return state;
  const { [id]: _, ...restSecrets } = state.secrets;
  const { [name]: __, ...restByName } = state.byName;
  return { ...state, secrets: restSecrets, byName: restByName };
}

export function listSecrets(state: SecretVaultState): string[] {
  return Object.keys(state.byName);
}

export function renameSecret(state: SecretVaultState, oldName: string, newName: string): SecretVaultState {
  if (oldName === newName) return state;
  const id = state.byName[oldName];
  if (!id) return state;
  const entry = state.secrets[id];
  if (!entry) return state;
  const { [oldName]: _, ...restByName } = state.byName;
  return { ...state, byName: { ...restByName, [newName]: id }, secrets: { ...state.secrets, [id]: { ...entry, name: newName } } };
}

/** Master metric: vault coverage 0-1. */
export function vaultCoverage(state: SecretVaultState): number {
  return state.masterKey.length >= 32 ? 1.0 : state.masterKey.length / 32;
}
