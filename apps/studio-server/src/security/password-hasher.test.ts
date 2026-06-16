// V18 PasswordHasher (Direction G 18/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, isStrongPassword, hashStrength } from "./password-hasher.js";

test("hashPassword: returns salt + hash", () => {
  const h = hashPassword("mypassword");
  assert.ok(h.salt.length > 0);
  assert.ok(h.hash.length > 0);
  assert.equal(h.digest, "sha256");
  assert.ok(h.iterations > 0);
});

test("hashPassword: same password → different hash (random salt)", () => {
  const a = hashPassword("mypassword");
  const b = hashPassword("mypassword");
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test("verifyPassword: correct password", () => {
  const h = hashPassword("mypassword");
  assert.equal(verifyPassword("mypassword", h), true);
});

test("verifyPassword: wrong password", () => {
  const h = hashPassword("mypassword");
  assert.equal(verifyPassword("wrong", h), false);
});

test("isStrongPassword: weak (short)", () => {
  assert.equal(isStrongPassword("ab1"), false);
});

test("isStrongPassword: weak (no upper)", () => {
  assert.equal(isStrongPassword("password1"), false);
});

test("isStrongPassword: weak (no digit)", () => {
  assert.equal(isStrongPassword("Password"), false);
});

test("isStrongPassword: strong", () => {
  assert.equal(isStrongPassword("Password1"), true);
});

test("hashStrength: 0.5 for 100k", () => {
  const h = hashPassword("x", 100_000);
  assert.equal(hashStrength(h), 0.5);
});

test("hashStrength: 0.25 for 50k", () => {
  const h = hashPassword("x", 50_000);
  assert.equal(hashStrength(h), 0.25);
});

test("verifyPassword: handles different length hash", () => {
  const h = hashPassword("mypassword");
  // Create a fake entry with a too-short hash to test length check
  const fake: HashedPassword = { hash: "abc", salt: h.salt, iterations: h.iterations, digest: h.digest };
  assert.equal(verifyPassword("mypassword", fake), false);
});

test("isStrongPassword: custom min length", () => {
  assert.equal(isStrongPassword("Ab1", { minLength: 2 } as never), true);
  // Use the default minLength 8
  assert.equal(isStrongPassword("Ab1cde", { minLength: 5 } as never), true);
});
