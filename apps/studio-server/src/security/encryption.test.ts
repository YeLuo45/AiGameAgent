// V25 Encryption (Direction G 25/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKey, encrypt, decrypt, encryptToString, decryptFromString, encryptionStrength } from "./encryption.js";

test("generateKey: 32 bytes", () => {
  const k = generateKey();
  assert.equal(k.length, 32);
});

test("encrypt + decrypt: roundtrip", () => {
  const k = generateKey();
  const payload = encrypt("hello world", k);
  assert.equal(decrypt(payload, k), "hello world");
});

test("encrypt: iv + tag + ciphertext are base64", () => {
  const k = generateKey();
  const p = encrypt("test", k);
  assert.ok(p.iv.length > 0);
  assert.ok(p.tag.length > 0);
  assert.ok(p.ciphertext.length > 0);
});

test("encrypt: different IV each time", () => {
  const k = generateKey();
  const a = encrypt("test", k);
  const b = encrypt("test", k);
  assert.notEqual(a.iv, b.iv);
});

test("decrypt: wrong key = throws", () => {
  const k1 = generateKey();
  const k2 = generateKey();
  const p = encrypt("secret", k1);
  assert.throws(() => decrypt(p, k2));
});

test("decrypt: tampered tag = throws", () => {
  const k = generateKey();
  const p = encrypt("secret", k);
  const tampered = { ...p, tag: "AAAA" + p.tag.slice(4) };
  assert.throws(() => decrypt(tampered, k));
});

test("encryptToString + decryptFromString: roundtrip", () => {
  const k = generateKey();
  const s = encryptToString("data", k);
  assert.equal(decryptFromString(s, k), "data");
});

test("encrypt: invalid key size throws", () => {
  const smallKey = Buffer.alloc(16);
  assert.throws(() => encrypt("x", smallKey));
});

test("encryptionStrength: 1.0 for full key", () => {
  assert.equal(encryptionStrength(generateKey()), 1.0);
});

test("encryptionStrength: < 1.0 for short key", () => {
  assert.equal(encryptionStrength(Buffer.alloc(16)), 0.5);
});
