// V27 SecretVault (Direction G 27/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSecretVault, setSecret, getSecret, deleteSecret, listSecrets, renameSecret, vaultCoverage } from "./secret-vault.js";

test("createSecretVault: empty", () => {
  const s = createSecretVault();
  assert.deepEqual(s.secrets, {});
  assert.deepEqual(s.byName, {});
  assert.equal(s.masterKey.length, 32);
});

test("setSecret: stores encrypted", () => {
  let s = createSecretVault();
  s = setSecret(s, "API_KEY", "secret-value");
  assert.ok(s.byName["API_KEY"]);
  const entry = s.secrets[s.byName["API_KEY"]];
  assert.ok(entry.ciphertext.ciphertext.length > 0);
});

test("getSecret: decrypts", () => {
  let s = createSecretVault();
  s = setSecret(s, "API_KEY", "secret-value");
  assert.equal(getSecret(s, "API_KEY"), "secret-value");
});

test("getSecret: missing = null", () => {
  assert.equal(getSecret(createSecretVault(), "nope"), null);
});

test("setSecret: updates existing", () => {
  let s = createSecretVault();
  s = setSecret(s, "key", "v1");
  const v1 = getSecret(s, "key");
  s = setSecret(s, "key", "v2");
  const v2 = getSecret(s, "key");
  assert.equal(v1, "v1");
  assert.equal(v2, "v2");
  assert.equal(s.secrets[s.byName["key"]].version, 2);
});

test("deleteSecret: removes", () => {
  let s = createSecretVault();
  s = setSecret(s, "key", "value");
  s = deleteSecret(s, "key");
  assert.equal(getSecret(s, "key"), null);
  assert.equal(listSecrets(s).length, 0);
});

test("deleteSecret: no-op for missing", () => {
  const s = createSecretVault();
  const s2 = deleteSecret(s, "nope");
  assert.equal(s2, s);
});

test("listSecrets: names", () => {
  let s = createSecretVault();
  s = setSecret(s, "a", "1");
  s = setSecret(s, "b", "2");
  assert.deepEqual(listSecrets(s).sort(), ["a", "b"]);
});

test("renameSecret: renames", () => {
  let s = createSecretVault();
  s = setSecret(s, "old", "value");
  s = renameSecret(s, "old", "new");
  assert.equal(getSecret(s, "old"), null);
  assert.equal(getSecret(s, "new"), "value");
});

test("renameSecret: same name = no-op", () => {
  let s = createSecretVault();
  s = setSecret(s, "key", "v");
  const s2 = renameSecret(s, "key", "key");
  assert.equal(s2, s);
});

test("renameSecret: missing = no-op", () => {
  const s = createSecretVault();
  const s2 = renameSecret(s, "missing", "new");
  assert.equal(s2, s);
});

test("vaultCoverage: 1.0 with proper master key", () => {
  assert.equal(vaultCoverage(createSecretVault()), 1.0);
});
