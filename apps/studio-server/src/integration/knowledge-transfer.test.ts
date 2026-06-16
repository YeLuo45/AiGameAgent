// V23 KnowledgeTransfer (Direction D 23/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createKnowledgeTransfer,
  transfer,
  receivedBy,
  sentBy,
  packetsByTopic,
  uniqueTopics,
  broadcast,
  knowledgeDensity,
} from "./knowledge-transfer.js";

test("createKnowledgeTransfer: empty", () => {
  const s = createKnowledgeTransfer();
  assert.equal(s.packets.length, 0);
});

test("transfer: records packet", () => {
  let s = createKnowledgeTransfer();
  s = transfer(s, "a1", "a2", "testing", { tip: "use mocks" });
  assert.equal(s.packets.length, 1);
  assert.equal(s.byAgent.a2.length, 1);
});

test("receivedBy: returns for agent", () => {
  let s = createKnowledgeTransfer();
  s = transfer(s, "a1", "a2", "x", {});
  s = transfer(s, "a3", "a2", "y", {});
  assert.equal(receivedBy(s, "a2").length, 2);
  assert.equal(receivedBy(s, "a1").length, 0);
});

test("sentBy: returns for sender", () => {
  let s = createKnowledgeTransfer();
  s = transfer(s, "a1", "a2", "x", {});
  s = transfer(s, "a1", "a3", "y", {});
  assert.equal(sentBy(s, "a1").length, 2);
});

test("packetsByTopic: filters by topic", () => {
  let s = createKnowledgeTransfer();
  s = transfer(s, "a", "b", "x", {});
  s = transfer(s, "a", "c", "y", {});
  assert.equal(packetsByTopic(s, "x").length, 1);
});

test("uniqueTopics: sorted unique", () => {
  let s = createKnowledgeTransfer();
  s = transfer(s, "a", "b", "z", {});
  s = transfer(s, "a", "b", "x", {});
  s = transfer(s, "a", "b", "y", {});
  assert.deepEqual(uniqueTopics(s), ["x", "y", "z"]);
});

test("broadcast: sends to multiple", () => {
  let s = createKnowledgeTransfer();
  s = broadcast(s, "teacher", ["s1", "s2", "s3"], "lesson", { data: 1 });
  assert.equal(receivedBy(s, "s1").length, 1);
  assert.equal(receivedBy(s, "s2").length, 1);
  assert.equal(receivedBy(s, "s3").length, 1);
});

test("broadcast: empty recipients = no-op", () => {
  const s = createKnowledgeTransfer();
  const s1 = broadcast(s, "x", [], "t", {});
  assert.equal(s1.packets.length, 0);
});

test("knowledgeDensity: 0 empty", () => {
  assert.equal(knowledgeDensity(createKnowledgeTransfer()), 0);
});

test("knowledgeDensity: scales with packets", () => {
  let s = createKnowledgeTransfer();
  for (let i = 0; i < 20; i++) s = transfer(s, "a", "b", "topic", {});
  assert.ok(knowledgeDensity(s) > 0);
});

test("knowledgeDensity: unique agents boost", () => {
  let s = createKnowledgeTransfer();
  for (let i = 0; i < 6; i++) s = transfer(s, "a", `b${i}`, "topic", {});
  assert.ok(knowledgeDensity(s) > 0);
});
