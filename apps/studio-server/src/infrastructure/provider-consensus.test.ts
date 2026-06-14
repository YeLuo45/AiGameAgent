// V21 ProviderConsensus (Direction E 21/30, chatdev) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findConsensus,
  consensusQuality,
  jaccard,
  normalize,
  DEFAULT_CONSENSUS_CONFIG,
} from "./provider-consensus.js";

test("normalize: lowercases + collapses whitespace", () => {
  assert.equal(normalize("Hello  WORLD"), "hello world");
  assert.equal(normalize("  foo\nbar  "), "foo bar");
});

test("jaccard: identical = 1", () => {
  assert.equal(jaccard("hello world", "hello world"), 1);
});

test("jaccard: completely different = 0", () => {
  assert.equal(jaccard("apple", "banana cherry"), 0);
});

test("jaccard: partial overlap", () => {
  const j = jaccard("the cat sat", "the dog sat");
  // setA = {the, cat, sat}, setB = {the, dog, sat} → inter=2, union=4
  assert.equal(j, 0.5);
});

test("jaccard: empty strings", () => {
  assert.equal(jaccard("", ""), 1);
});

test("findConsensus: empty", () => {
  const r = findConsensus([]);
  assert.equal(r.accepted, false);
  assert.equal(r.text, "");
});

test("findConsensus: single answer = accepted", () => {
  const r = findConsensus([{ providerId: "a", text: "hi", confidence: 0.9, latencyMs: 100 }]);
  assert.equal(r.accepted, true);
  assert.equal(r.text, "hi");
  assert.equal(r.totalProviders, 1);
});

test("findConsensus: highest-confidence strategy", () => {
  const answers = [
    { providerId: "a", text: "first", confidence: 0.5, latencyMs: 100 },
    { providerId: "b", text: "second", confidence: 0.9, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "highest-confidence", minAgreement: 0.5 });
  assert.equal(r.text, "second");
  assert.equal(r.agreedProviders[0], "b");
});

test("findConsensus: longest strategy", () => {
  const answers = [
    { providerId: "a", text: "short", confidence: 0.9, latencyMs: 100 },
    { providerId: "b", text: "much longer answer with details", confidence: 0.5, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "longest", minAgreement: 0.5 });
  assert.equal(r.text, "much longer answer with details");
});

test("findConsensus: majority-vote (all agree)", () => {
  const answers = [
    { providerId: "a", text: "the answer is 42", confidence: 0.8, latencyMs: 100 },
    { providerId: "b", text: "the answer is 42", confidence: 0.9, latencyMs: 100 },
    { providerId: "c", text: "the answer is 42", confidence: 0.7, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "majority-vote", minAgreement: 0.6 });
  assert.equal(r.accepted, true);
  assert.equal(r.agreement, 1);
  assert.equal(r.agreedProviders.length, 3);
});

test("findConsensus: majority-vote (2/3 agree)", () => {
  const answers = [
    { providerId: "a", text: "the answer is 42", confidence: 0.8, latencyMs: 100 },
    { providerId: "b", text: "the answer is 42", confidence: 0.9, latencyMs: 100 },
    { providerId: "c", text: "totally different", confidence: 0.7, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "majority-vote", minAgreement: 0.5 });
  assert.equal(r.accepted, true);
  assert.equal(r.agreedProviders.length, 2);
});

test("findConsensus: majority-vote (no agreement)", () => {
  const answers = [
    { providerId: "a", text: "answer one", confidence: 0.8, latencyMs: 100 },
    { providerId: "b", text: "answer two", confidence: 0.9, latencyMs: 100 },
    { providerId: "c", text: "answer three", confidence: 0.7, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "majority-vote", minAgreement: 0.5 });
  assert.equal(r.accepted, false);
});

test("findConsensus: weighted (highest conf + jaccard agreement)", () => {
  const answers = [
    { providerId: "a", text: "the answer is 42", confidence: 0.9, latencyMs: 100 },
    { providerId: "b", text: "the answer is 42", confidence: 0.5, latencyMs: 100 },
    { providerId: "c", text: "totally different", confidence: 0.7, latencyMs: 100 },
  ];
  const r = findConsensus(answers, { strategy: "weighted", minAgreement: 0.5 });
  assert.equal(r.text, "the answer is 42");
  assert.equal(r.agreement, 2 / 3);
});

test("DEFAULT_CONSENSUS_CONFIG: weighted + 0.6", () => {
  assert.equal(DEFAULT_CONSENSUS_CONFIG.strategy, "weighted");
  assert.equal(DEFAULT_CONSENSUS_CONFIG.minAgreement, 0.6);
});

test("consensusQuality: agreement × confidence", () => {
  const r: ReturnType<typeof findConsensus> = { text: "x", agreement: 0.8, confidence: 0.5, totalProviders: 2, agreedProviders: ["a"], strategy: "weighted", accepted: true };
  assert.equal(consensusQuality(r), 0.4);
});

test("consensusQuality: zero total = 0", () => {
  const r: ReturnType<typeof findConsensus> = { text: "", agreement: 0, confidence: 0, totalProviders: 0, agreedProviders: [], strategy: "weighted", accepted: false };
  assert.equal(consensusQuality(r), 0);
});
