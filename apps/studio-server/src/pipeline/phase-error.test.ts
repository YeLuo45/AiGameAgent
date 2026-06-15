// V9 PhaseError (Direction C 9/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createErrorState,
  recordError,
  errorsFor,
  hasErrors,
  clearErrors,
  countByKind,
  recoverableErrors,
  shouldRetry,
  errorRecoveryRate,
} from "./phase-error.js";

test("createErrorState: empty", () => {
  const s = createErrorState();
  assert.equal(s.errors.length, 0);
  assert.equal(s.nextId, 1);
});

test("recordError: adds to errors + byPhase", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "validation", "missing field", false);
  assert.equal(s.errors.length, 1);
  assert.equal(s.byPhase.ideation.length, 1);
});

test("recordError: auto-increments id", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "validation", "x");
  s = recordError(s, "ideation", "validation", "y");
  assert.equal(s.errors[1].id, 2);
});

test("recordError: recoverable flag", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "timeout", "x", false);
  assert.equal(s.errors[0].recoverable, false);
});

test("recordError: optional context", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "validation", "x", true, "stack trace here");
  assert.equal(s.errors[0].context, "stack trace here");
});

test("errorsFor: returns phase errors", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "y");
  s = recordError(s, "design", "x", "z");
  assert.equal(errorsFor(s, "ideation").length, 1);
  assert.equal(errorsFor(s, "design").length, 1);
});

test("errorsFor: empty for unknown phase", () => {
  assert.deepEqual(errorsFor(createErrorState(), "ideation"), []);
});

test("hasErrors: true/false", () => {
  let s = createErrorState();
  assert.equal(hasErrors(s, "ideation"), false);
  s = recordError(s, "ideation", "x", "y");
  assert.equal(hasErrors(s, "ideation"), true);
});

test("clearErrors: removes from phase", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "y");
  s = recordError(s, "design", "x", "z");
  s = clearErrors(s, "ideation");
  assert.equal(s.errors.length, 1);
  assert.equal(s.byPhase.ideation, undefined);
  assert.equal(s.byPhase.design.length, 1);
});

test("countByKind: aggregate", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "validation", "x");
  s = recordError(s, "design", "validation", "y");
  s = recordError(s, "release", "timeout", "z");
  const c = countByKind(s);
  assert.equal(c.validation, 2);
  assert.equal(c.timeout, 1);
});

test("recoverableErrors: only recoverable", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "y", true);
  s = recordError(s, "design", "x", "z", false);
  assert.equal(recoverableErrors(s).length, 1);
});

test("shouldRetry: true when no errors", () => {
  assert.equal(shouldRetry(createErrorState(), "ideation", 3), true);
});

test("shouldRetry: false when over max", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "1");
  s = recordError(s, "ideation", "x", "2");
  s = recordError(s, "ideation", "x", "3");
  assert.equal(shouldRetry(s, "ideation", 3), false);
});

test("shouldRetry: false if last is non-recoverable", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "1", true);
  s = recordError(s, "ideation", "x", "2", false);
  assert.equal(shouldRetry(s, "ideation", 3), false);
});

test("errorRecoveryRate: 1.0 empty", () => {
  assert.equal(errorRecoveryRate(createErrorState()), 1.0);
});

test("errorRecoveryRate: 0.5 mixed", () => {
  let s = createErrorState();
  s = recordError(s, "ideation", "x", "y", true);
  s = recordError(s, "design", "x", "z", false);
  assert.equal(errorRecoveryRate(s), 0.5);
});
