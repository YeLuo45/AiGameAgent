// V17 AuthSession (Direction G 17/30, generic-agent)
// Session lifecycle: login → active → expired/revoked

import { type AuthToken, issueToken, verifyToken, createPayload } from "./auth-token.js";

export type SessionStatus = "active" | "expired" | "revoked" | "idle";

export interface AuthSession {
  id: string;
  userId: string;
  token: AuthToken;
  status: SessionStatus;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  /** Source IP. */
  ip: string | null;
  /** User agent. */
  userAgent: string | null;
}

export interface AuthSessionState {
  sessions: Record<string, AuthSession>;
  nextId: number;
}

export function createSessionState(): AuthSessionState {
  return { sessions: {}, nextId: 1 };
}

export function login(state: AuthSessionState, userId: string, secret: string, ttlMs: number = 3_600_000, ip: string | null = null, userAgent: string | null = null): AuthSessionState {
  const now = Date.now();
  const id = `sess-${state.nextId}`;
  const payload = createPayload(userId, ttlMs, { sid: id });
  const session: AuthSession = { id, userId, token: { token: issueToken(payload, secret), payload }, status: "active", createdAt: now, lastActiveAt: now, expiresAt: now + ttlMs, ip, userAgent };
  return { ...state, sessions: { ...state.sessions, [id]: session }, nextId: state.nextId + 1 };
}

export function getSession(state: AuthSessionState, id: string): AuthSession | undefined {
  return state.sessions[id];
}

export function touchSession(state: AuthSessionState, id: string, now: number = Date.now()): AuthSessionState {
  const cur = state.sessions[id];
  if (!cur) return state;
  return { ...state, sessions: { ...state.sessions, [id]: { ...cur, lastActiveAt: now } } };
}

export function expireSession(state: AuthSessionState, id: string): AuthSessionState {
  const cur = state.sessions[id];
  if (!cur) return state;
  return { ...state, sessions: { ...state.sessions, [id]: { ...cur, status: "expired" } } };
}

export function revokeSession(state: AuthSessionState, id: string): AuthSessionState {
  const cur = state.sessions[id];
  if (!cur) return state;
  return { ...state, sessions: { ...state.sessions, [id]: { ...cur, status: "revoked" } } };
}

export function listSessions(state: AuthSessionState, filter: { status?: SessionStatus; userId?: string } = {}): AuthSession[] {
  let arr = Object.values(state.sessions);
  if (filter.status) arr = arr.filter((s) => s.status === filter.status);
  if (filter.userId) arr = arr.filter((s) => s.userId === filter.userId);
  return arr;
}

export function cleanupExpired(state: AuthSessionState, now: number = Date.now()): AuthSessionState {
  const next: Record<string, AuthSession> = {};
  for (const [id, s] of Object.entries(state.sessions)) {
    if (s.expiresAt > now && s.status === "active") {
      next[id] = s;
    } else if (s.status !== "active") {
      next[id] = s;
    }
  }
  return { ...state, sessions: next };
}

/** Master metric: session health 0-1. */
export function sessionHealth(state: AuthSessionState): number {
  const total = Object.keys(state.sessions).length;
  if (total === 0) return 1.0;
  const active = listSessions(state, { status: "active" }).length;
  return active / total;
}
