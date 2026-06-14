// V23 BashTool (Direction B 23/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBashCommand, simulateBash, DEFAULT_BASH_POLICY } from "./bash-tool.js";

test("DEFAULT_BASH_POLICY: safe defaults", () => {
  assert.ok(DEFAULT_BASH_POLICY.allow.includes("ls"));
  assert.ok(DEFAULT_BASH_POLICY.deny.includes("rm -rf"));
});

test("validateBashCommand: allowed command", () => {
  assert.equal(validateBashCommand("ls -la").valid, true);
});

test("validateBashCommand: denied command (rm -rf)", () => {
  const r = validateBashCommand("rm -rf /");
  assert.equal(r.valid, false);
  assert.ok(r.reason?.includes("denied"));
});

test("validateBashCommand: sudo denied", () => {
  assert.equal(validateBashCommand("sudo apt install").valid, false);
});

test("validateBashCommand: not in allowlist", () => {
  const r = validateBashCommand("weirdcmd");
  assert.equal(r.valid, false);
  assert.ok(r.reason?.includes("allowlist"));
});

test("validateBashCommand: too long", () => {
  const r = validateBashCommand("a".repeat(1000));
  assert.equal(r.valid, false);
  assert.equal(r.reason, "too_long");
});

test("validateBashCommand: custom policy allows", () => {
  const r = validateBashCommand("mycmd arg", { allow: ["mycmd"], deny: [], maxLength: 100 });
  assert.equal(r.valid, true);
});

test("simulateBash: denied = exit 1", () => {
  const r = simulateBash({ command: "rm -rf /" });
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 1);
});

test("simulateBash: allowed = exit 0", () => {
  const r = simulateBash({ command: "ls" });
  assert.equal(r.ok, true);
  assert.equal(r.exitCode, 0);
});
