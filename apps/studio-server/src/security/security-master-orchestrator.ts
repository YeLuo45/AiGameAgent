// V30 SecurityMasterOrchestrator (Direction G 30/30, orchestrator)
// Master orchestrator: integrate Auth + RBAC + Audit + Threat + Policy

import { type AuthSessionState, sessionHealth } from "./auth-session.js";
import { type RBACState, rbacCoverage } from "./rbac.js";
import { type AuditTrail, auditIntegrity } from "./audit-trail.js";
import { type ThreatDetectorState, threatSeverity } from "./threat-detector.js";
import { type SecurityPolicyState, policyCoverage } from "./security-policy.js";

export interface SecurityMasterSnapshot {
  sessionHealth: number;
  rbacCoverage: number;
  auditIntegrity: number;
  threatSeverity: number;
  policyCoverage: number;
  overall: number;
}

export function buildSecuritySnapshot(input: {
  sessions: AuthSessionState;
  rbac: RBACState;
  audit: AuditTrail;
  threats: ThreatDetectorState;
  policy: SecurityPolicyState;
}): SecurityMasterSnapshot {
  const values = [
    sessionHealth(input.sessions),
    rbacCoverage(input.rbac),
    auditIntegrity(input.audit),
    1 - threatSeverity(input.threats), // lower threats = better
    policyCoverage(input.policy),
  ];
  const overall = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    sessionHealth: values[0],
    rbacCoverage: values[1],
    auditIntegrity: values[2],
    threatSeverity: threatSeverity(input.threats),
    policyCoverage: values[4],
    overall,
  };
}

export function securityAction(snap: SecurityMasterSnapshot): "lock-down" | "revoke-sessions" | "investigate-audit" | "mitigate-threat" | "strengthen-policy" | "hold" {
  if (snap.auditIntegrity < 0.9) return "investigate-audit";
  if (snap.threatSeverity > 0.5) return "mitigate-threat";
  if (snap.policyCoverage < 0.5) return "strengthen-policy";
  if (snap.sessionHealth < 0.5) return "revoke-sessions";
  if (snap.overall < 0.4) return "lock-down";
  return "hold";
}

/** Master metric: security posture 0-1. */
export function securityPosture(snap: SecurityMasterSnapshot): number {
  return snap.overall;
}
