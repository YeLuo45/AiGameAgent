// V22 ApiKey (Direction G 22/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateApiKey, verifyApiKey, hasScope, markUsed, revokeKey, isExpired, keyLiveness } from "./api-key.js";

test("generateApiKey: returns key + secret", () => {
  const { apiKey, secret } = generateApiKey();
  assert.ok(apiKey.keyId.startsWith("ak_"));
  assert.ok(secret.length > 20);
  assert.equal(apiKey.revoked, false);
});

test("verifyApiKey: correct secret", () => {
  const { apiKey, secret } = generateApiKey();
  assert.equal(verifyApiKey(apiKey, secret), true);
});

test("verifyApiKey: wrong secret", () => {
  const { apiKey } = generateApiKey();
  assert.equal(verifyApiKey(apiKey, "wrong"), false);
});

test("verifyApiKey: revoked = false", () => {
  const { apiKey, secret } = generateApiKey();
  assert.equal(verifyApiKey(revokeKey(apiKey), secret), false);
});

test("verifyApiKey: expired = false", () => {
  const { apiKey, secret } = generateApiKey([], -1);
  assert.equal(verifyApiKey(apiKey, secret), false);
});

test("hasScope: exact match", () => {
  const { apiKey } = generateApiKey(["read", "write"]);
  assert.equal(hasScope(apiKey, "read"), true);
  assert.equal(hasScope(apiKey, "admin"), false);
});

test("hasScope: wildcard", () => {
  const { apiKey } = generateApiKey(["*"]);
  assert.equal(hasScope(apiKey, "anything"), true);
});

test("markUsed: updates lastUsedAt", () => {
  const { apiKey } = generateApiKey();
  const used = markUsed(apiKey, 5000);
  assert.equal(used.lastUsedAt, 5000);
});

test("revokeKey: sets revoked", () => {
  const { apiKey } = generateApiKey();
  assert.equal(revokeKey(apiKey).revoked, true);
});

test("isExpired: true for negative TTL", () => {
  const { apiKey } = generateApiKey([], -1);
  assert.equal(isExpired(apiKey), true);
});

test("isExpired: false for null TTL", () => {
  const { apiKey } = generateApiKey([], null);
  assert.equal(isExpired(apiKey), false);
});

test("keyLiveness: 0 for revoked", () => {
  const { apiKey } = generateApiKey();
  assert.equal(keyLiveness(revokeKey(apiKey)), 0);
});

test("keyLiveness: 0 for expired", () => {
  const { apiKey } = generateApiKey([], -1);
  assert.equal(keyLiveness(apiKey), 0);
});

test("keyLiveness: 1 for fresh", () => {
  const { apiKey } = generateApiKey();
  assert.equal(keyLiveness(apiKey), 1);
});
