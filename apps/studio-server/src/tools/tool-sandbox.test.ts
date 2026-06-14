// V24 ToolSandbox (Direction B 24/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPath,
  checkOutputSize,
  checkDuration,
  checkMemory,
  sandboxTightness,
  DEFAULT_SANDBOX_CONFIG,
} from "./tool-sandbox.js";

test("DEFAULT_SANDBOX_CONFIG: sane defaults", () => {
  assert.ok(DEFAULT_SANDBOX_CONFIG.maxDurationMs > 0);
  assert.ok(DEFAULT_SANDBOX_CONFIG.blockedPaths.length > 0);
});

test("checkPath: /etc blocked", () => {
  const r = checkPath("/etc/passwd", DEFAULT_SANDBOX_CONFIG);
  assert.equal(r.allowed, false);
  assert.ok(r.reason?.includes("blocked"));
});

test("checkPath: /root blocked", () => {
  assert.equal(checkPath("/root/secret", DEFAULT_SANDBOX_CONFIG).allowed, false);
});

test("checkPath: /tmp allowed", () => {
  assert.equal(checkPath("/tmp/foo", DEFAULT_SANDBOX_CONFIG).allowed, true);
});

test("checkPath: /workspace allowed", () => {
  assert.equal(checkPath("/workspace/project", DEFAULT_SANDBOX_CONFIG).allowed, true);
});

test("checkPath: /unknown not allowed", () => {
  const r = checkPath("/unknown/path", DEFAULT_SANDBOX_CONFIG);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "not_in_allowed_paths");
});

test("checkPath: custom config allows all", () => {
  const r = checkPath("/anything", { ...DEFAULT_SANDBOX_CONFIG, allowedPaths: ["/"], blockedPaths: [] });
  assert.equal(r.allowed, true);
});

test("checkOutputSize: under limit", () => {
  assert.equal(checkOutputSize("a".repeat(100), DEFAULT_SANDBOX_CONFIG).allowed, true);
});

test("checkOutputSize: over limit", () => {
  const r = checkOutputSize("a".repeat(DEFAULT_SANDBOX_CONFIG.maxOutputBytes + 1), DEFAULT_SANDBOX_CONFIG);
  assert.equal(r.allowed, false);
});

test("checkDuration: under limit", () => {
  assert.equal(checkDuration(1000, DEFAULT_SANDBOX_CONFIG).allowed, true);
});

test("checkDuration: timeout", () => {
  const r = checkDuration(DEFAULT_SANDBOX_CONFIG.maxDurationMs + 1, DEFAULT_SANDBOX_CONFIG);
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "timeout");
});

test("checkMemory: under limit", () => {
  assert.equal(checkMemory(1024, DEFAULT_SANDBOX_CONFIG).allowed, true);
});

test("checkMemory: exceeded", () => {
  const r = checkMemory(DEFAULT_SANDBOX_CONFIG.maxMemoryBytes + 1, DEFAULT_SANDBOX_CONFIG);
  assert.equal(r.allowed, false);
});

test("sandboxTightness: defaults = high", () => {
  assert.ok(sandboxTightness(DEFAULT_SANDBOX_CONFIG) > 0.5);
});

test("sandboxTightness: loose = lower", () => {
  const loose: typeof DEFAULT_SANDBOX_CONFIG = {
    maxDurationMs: 600_000,
    maxMemoryBytes: 4 * 1024 * 1024 * 1024,
    allowedPaths: ["/"],
    blockedPaths: [],
    maxOutputBytes: 100 * 1024 * 1024,
  };
  assert.ok(sandboxTightness(loose) < 0.5);
});
