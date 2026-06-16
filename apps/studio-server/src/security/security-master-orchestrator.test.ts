// V30 SecurityMasterOrchestrator (Direction G 30/30, orchestrator) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSecuritySnapshot, securityAction, securityPosture } from "./security-master-orchestrator.js";
import { createSessionState, login, revokeSession, listSessions } from "./auth-session.js";
import { createRBACState, assignRole, defineRole } from "./rbac.js";
import { createAuditTrail, appendAudit } from "./audit-trail.js";
import { createThreatDetector, emitSignal } from "./threat-detector.js";
import { createSecurityPolicyState, addRule } from "./security-policy.js";
import { randomSecret } from "./auth-token.js";

test("buildSecuritySnapshot: all 5 fields", () => {
  const s = buildSecuritySnapshot({
    sessions: createSessionState(),
    rbac: createRBACState(),
    audit: createAuditTrail(),
    threats: createThreatDetector(),
    policy: createSecurityPolicyState(),
  });
  assert.ok("sessionHealth" in s);
  assert.ok("rbacCoverage" in s);
  assert.ok("auditIntegrity" in s);
  assert.ok("threatSeverity" in s);
  assert.ok("policyCoverage" in s);
  assert.ok("overall" in s);
});

test("buildSecuritySnapshot: empty overall = mid", () => {
  const s = buildSecuritySnapshot({
    sessions: createSessionState(),
    rbac: createRBACState(),
    audit: createAuditTrail(),
    threats: createThreatDetector(),
    policy: createSecurityPolicyState(),
  });
  // sessionHealth=1, rbac=0, audit=1, threatSev=0 → 1-threatSev=1, policy=0.4
  // avg = (1 + 0 + 1 + 1 + 0.4) / 5 = 3.4/5 = 0.68
  assert.ok(s.overall > 0.5);
});

test("securityAction: audit broken → investigate-audit", () => {
  const audit = createAuditTrail();
  // Empty audit is fine (returns true). Need to actually break chain
  let a = createAuditTrail();
  a = appendAudit(a, "u1", "create", "p1");
  a = appendAudit(a, "u2", "update", "p1");
  const tampered = { ...a, entries: a.entries.map((e, i) => i === 0 ? { ...e, actor: "hacker" } : e) };
  const s = buildSecuritySnapshot({
    sessions: createSessionState(), rbac: createRBACState(), audit: tampered, threats: createThreatDetector(), policy: createSecurityPolicyState(),
  });
  assert.equal(securityAction(s), "investigate-audit");
});

test("securityAction: high threat → mitigate-threat", () => {
  let t = createThreatDetector();
  for (let i = 0; i < 3; i++) t = emitSignal(t, "critical", "x", "y", {});
  const s = buildSecuritySnapshot({
    sessions: createSessionState(), rbac: createRBACState(), audit: createAuditTrail(), threats: t, policy: createSecurityPolicyState(),
  });
  assert.equal(securityAction(s), "mitigate-threat");
});

test("securityAction: low policy → strengthen-policy", () => {
  const policy = createSecurityPolicyState();
  // No rules, no IPs, but minLength 8 so policyCoverage = 0.4
  const s = buildSecuritySnapshot({
    sessions: createSessionState(), rbac: createRBACState(), audit: createAuditTrail(), threats: createThreatDetector(), policy,
  });
  // policyCoverage = 0.4 < 0.5, no threats, audit ok → strengthen-policy
  assert.equal(securityAction(s), "strengthen-policy");
});

test("securityAction: low session → revoke-sessions", () => {
  const secret = randomSecret();
  let sessions = createSessionState();
  sessions = login(sessions, "u1", secret);
  sessions = login(sessions, "u1", secret);
  sessions = login(sessions, "u1", secret);
  // Revoke most
  for (let i = 0; i < 2; i++) {
    const id = listSessions(sessions)[i].id;
    sessions = revokeSession(sessions, id);
  }
  // Now 1/3 active
  const s = buildSecuritySnapshot({
    sessions, rbac: createRBACState(), audit: createAuditTrail(), threats: createThreatDetector(), policy: createSecurityPolicyState(),
  });
  // policyCoverage=0.4 < 0.5 still → strengthen-policy
  // So we need policy first - let me make policy strong
  // Actually let me use a strong policy
  const policy = createSecurityPolicyState();
  let ps = policy;
  ps = addRule(ps, { id: "r1", name: "r", resource: "x", action: "allow", enabled: true, priority: 1 });
  ps = { ...ps, allowIps: ["1.2.3.4"] };
  const s2 = buildSecuritySnapshot({
    sessions, rbac: createRBACState(), audit: createAuditTrail(), threats: createThreatDetector(), policy: ps,
  });
  // policyCoverage=1, sessionHealth=1/3 → revoke-sessions
  assert.equal(securityAction(s2), "revoke-sessions");
});

test("securityAction: all nominal → hold", () => {
  const secret = randomSecret();
  let sessions = createSessionState();
  sessions = login(sessions, "u1", secret);
  let rbac = createRBACState();
  rbac = defineRole(rbac, { id: "admin", name: "Admin", permissions: ["read"], parent: null });
  rbac = assignRole(rbac, "u1", "admin");
  let audit = createAuditTrail();
  audit = appendAudit(audit, "u1", "create", "p1");
  let policy = createSecurityPolicyState();
  policy = addRule(policy, { id: "r1", name: "r", resource: "x", action: "allow", enabled: true, priority: 1 });
  policy = { ...policy, allowIps: ["1.2.3.4"] };
  const s = buildSecuritySnapshot({
    sessions, rbac, audit, threats: createThreatDetector(), policy,
  });
  assert.equal(securityAction(s), "hold");
});

test("securityPosture: alias for overall", () => {
  const s = buildSecuritySnapshot({
    sessions: createSessionState(), rbac: createRBACState(), audit: createAuditTrail(), threats: createThreatDetector(), policy: createSecurityPolicyState(),
  });
  assert.equal(securityPosture(s), s.overall);
});
