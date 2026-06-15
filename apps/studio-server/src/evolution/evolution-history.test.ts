// V17 EvolutionHistory (Direction D 17/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEvolutionHistory,
  recordEvolution,
  queryEvolution,
  latestEvolution,
  countByKind,
  rollbackTo,
  evolutionVelocity,
} from "./evolution-history.js";

test("createEvolutionHistory: empty", () => {
  const s = createEvolutionHistory();
  assert.equal(s.entries.length, 0);
  assert.equal(s.nextId, 1);
});

test("recordEvolution: with before/after", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "temperature", "user", "make faster", 0.9, 0.5, 0.7);
  assert.equal(s.entries[0].before, 0.5);
  assert.equal(s.entries[0].after, 0.7);
});

test("recordEvolution: without before/after", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "skill-added", "Read", "user", "needed");
  assert.equal(s.entries[0].before, undefined);
});

test("recordEvolution: updates byKind index", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "param-tuned", "y", "u", "");
  s = recordEvolution(s, "skill-added", "Read", "u", "");
  assert.equal(s.byKind["param-tuned"].length, 2);
  assert.equal(s.byKind["skill-added"].length, 1);
});

test("queryEvolution: by kind", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "skill-added", "Read", "u", "");
  assert.equal(queryEvolution(s, { kind: "param-tuned" }).length, 1);
});

test("queryEvolution: by target", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "param-tuned", "y", "u", "");
  assert.equal(queryEvolution(s, { target: "x" }).length, 1);
});

test("queryEvolution: by since", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  const since = Date.now() + 100;
  assert.equal(queryEvolution(s, { since }).length, 0);
});

test("queryEvolution: by actor", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "alice", "");
  s = recordEvolution(s, "param-tuned", "y", "bob", "");
  assert.equal(queryEvolution(s, { actor: "alice" }).length, 1);
});

test("latestEvolution: returns most recent", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "param-tuned", "y", "u", "");
  assert.equal(latestEvolution(s)?.target, "y");
});

test("latestEvolution: filtered by target", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "param-tuned", "y", "u", "");
  assert.equal(latestEvolution(s, "x")?.target, "x");
});

test("countByKind: aggregate", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "");
  s = recordEvolution(s, "param-tuned", "y", "u", "");
  s = recordEvolution(s, "skill-added", "Read", "u", "");
  const c = countByKind(s);
  assert.equal(c["param-tuned"], 2);
  assert.equal(c["skill-added"], 1);
});

test("rollbackTo: adds rollback entry", () => {
  let s = createEvolutionHistory();
  s = recordEvolution(s, "param-tuned", "x", "u", "", 0.9, 0.5, 0.7);
  s = rollbackTo(s, 1);
  const last = s.entries[s.entries.length - 1];
  assert.equal(last.kind, "rollback");
  assert.equal(last.after, 0.5); // restored to before
});

test("rollbackTo: no-op for missing", () => {
  const s = createEvolutionHistory();
  const s2 = rollbackTo(s, 99);
  assert.equal(s2, s);
});

test("evolutionVelocity: 0 for <2", () => {
  const s = createEvolutionHistory();
  assert.equal(evolutionVelocity(s), 0);
});

test("evolutionVelocity: 1/hr for 2 events in 1h", () => {
  const now = Date.now();
  const s = {
    ...createEvolutionHistory(),
    entries: [
      { id: 1, ts: now, kind: "param-tuned" as const, target: "x", actor: "u", reason: "", confidence: 0.5 },
      { id: 2, ts: now + 3_600_000, kind: "param-tuned" as const, target: "y", actor: "u", reason: "", confidence: 0.5 },
    ],
  };
  assert.equal(evolutionVelocity(s), 1);
});
