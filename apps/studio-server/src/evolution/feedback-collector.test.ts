// V13 FeedbackCollector (Direction D 13/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createFeedbackCollector,
  recordFeedback,
  queryFeedback,
  countBySentiment,
  averageScore,
  feedbackSentiment,
} from "./feedback-collector.js";

test("createFeedbackCollector: empty", () => {
  const s = createFeedbackCollector();
  assert.equal(s.entries.length, 0);
});

test("recordFeedback: adds entry", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "Read", "positive", 1, "good");
  assert.equal(s.entries.length, 1);
});

test("recordFeedback: with meta", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "Read", "positive", 1, "good", { taskId: "t1" });
  assert.equal(s.entries[0].meta?.taskId, "t1");
});

test("recordFeedback: maxEntries evicts", () => {
  let s = createFeedbackCollector(2);
  s = recordFeedback(s, "user", "a", "positive", 1, "1");
  s = recordFeedback(s, "user", "a", "positive", 1, "2");
  s = recordFeedback(s, "user", "a", "positive", 1, "3");
  assert.equal(s.entries.length, 2);
  assert.equal(s.entries[0].comment, "2");
});

test("queryFeedback: by source", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "positive", 1, "1");
  s = recordFeedback(s, "agent", "a", "negative", -1, "2");
  assert.equal(queryFeedback(s, { source: "user" }).length, 1);
});

test("queryFeedback: by target", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "Read", "positive", 1, "");
  s = recordFeedback(s, "user", "Write", "positive", 1, "");
  assert.equal(queryFeedback(s, { target: "Read" }).length, 1);
});

test("queryFeedback: by sentiment", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "positive", 1, "");
  s = recordFeedback(s, "user", "a", "negative", -1, "");
  assert.equal(queryFeedback(s, { sentiment: "positive" }).length, 1);
});

test("queryFeedback: by since", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "positive", 1, "");
  const since = Date.now() + 100;
  assert.equal(queryFeedback(s, { since }).length, 0);
});

test("countBySentiment: aggregate", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "positive", 1, "");
  s = recordFeedback(s, "user", "a", "positive", 1, "");
  s = recordFeedback(s, "user", "a", "negative", -1, "");
  const c = countBySentiment(s);
  assert.equal(c.positive, 2);
  assert.equal(c.negative, 1);
});

test("averageScore: 0 empty", () => {
  assert.equal(averageScore(createFeedbackCollector()), 0);
});

test("averageScore: by target", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "Read", "positive", 1, "");
  s = recordFeedback(s, "user", "Read", "negative", -1, "");
  s = recordFeedback(s, "user", "Write", "positive", 1, "");
  assert.equal(averageScore(s, "Read"), 0);
  assert.equal(averageScore(s, "Write"), 1);
});

test("feedbackSentiment: 0.5 empty (neutral)", () => {
  assert.equal(feedbackSentiment(createFeedbackCollector()), 0.5);
});

test("feedbackSentiment: 1.0 all positive", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "positive", 1, "");
  s = recordFeedback(s, "user", "b", "positive", 1, "");
  assert.equal(feedbackSentiment(s), 1.0);
});

test("feedbackSentiment: 0.0 all negative", () => {
  let s = createFeedbackCollector();
  s = recordFeedback(s, "user", "a", "negative", -1, "");
  s = recordFeedback(s, "user", "b", "negative", -1, "");
  assert.equal(feedbackSentiment(s), 0);
});
