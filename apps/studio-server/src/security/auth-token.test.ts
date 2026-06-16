// V16 AuthToken (Direction G 16/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { issueToken, verifyToken, createPayload, randomSecret, tokenValidityRate } from "./auth-token.js";

test("issueToken + verifyToken: roundtrip", () => {
  const secret = randomSecret();
  const payload = createPayload("user1", 60_000, { role: "admin" });
  const token = issueToken(payload, secret);
  const verified = verifyToken(token, secret);
  assert.equal(verified?.sub, "user1");
  assert.equal(verified?.claims.role, "admin");
});

test("verifyToken: wrong secret = null", () => {
  const secret = randomSecret();
  const payload = createPayload("user1", 60_000);
  const token = issueToken(payload, secret);
  assert.equal(verifyToken(token, randomSecret()), null);
});

test("verifyToken: malformed = null", () => {
  assert.equal(verifyToken("invalid", "secret"), null);
  assert.equal(verifyToken("a.b", "secret"), null);
});

test("verifyToken: expired = null", () => {
  const secret = randomSecret();
  const payload = createPayload("user1", -1); // already expired
  const token = issueToken(payload, secret);
  assert.equal(verifyToken(token, secret), null);
});

test("verifyToken: tampered = null", () => {
  const secret = randomSecret();
  const payload = createPayload("user1", 60_000);
  const token = issueToken(payload, secret);
  const tampered = token.slice(0, -2) + "AA";
  assert.equal(verifyToken(tampered, secret), null);
});

test("createPayload: includes timestamps", () => {
  const p = createPayload("user1", 60_000);
  assert.equal(p.sub, "user1");
  assert.ok(p.exp > p.iat);
  assert.ok(p.exp - p.iat === 60_000);
});

test("tokenValidityRate: 1.0 for empty", () => {
  assert.equal(tokenValidityRate([], "secret"), 1.0);
});

test("tokenValidityRate: ratio", () => {
  const secret = randomSecret();
  const valid = issueToken(createPayload("u1", 60_000), secret);
  const expired = issueToken(createPayload("u1", -1), secret);
  assert.equal(tokenValidityRate([valid, expired], secret), 0.5);
});
