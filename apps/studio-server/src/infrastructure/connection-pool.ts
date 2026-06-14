// V15 ConnectionPool (Direction E 15/30, nanobot)
// Per-provider connection pool with checkout/release semantics

export type ConnectionState = "idle" | "in-use" | "closed";

export interface PooledConnection {
  id: string;
  providerId: string;
  state: ConnectionState;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

export interface ConnectionPoolState {
  providerId: string;
  maxSize: number;
  minSize: number;
  connections: PooledConnection[];
  totalCreated: number;
  totalClosed: number;
  totalCheckouts: number;
  nextConnId: number;
}

export function createConnectionPool(providerId: string, maxSize: number = 5, minSize: number = 1): ConnectionPoolState {
  let state: ConnectionPoolState = {
    providerId,
    maxSize,
    minSize,
    connections: [],
    totalCreated: 0,
    totalClosed: 0,
    totalCheckouts: 0,
    nextConnId: 1,
  };
  // Pre-create minSize
  for (let i = 0; i < minSize; i++) {
    const r = createConnection(state);
    state = r.state;
  }
  return state;
}

function createConnection(state: ConnectionPoolState): { state: ConnectionPoolState; conn: PooledConnection } {
  const conn: PooledConnection = {
    id: `c${state.nextConnId}`,
    providerId: state.providerId,
    state: "idle",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    useCount: 0,
  };
  return {
    state: {
      ...state,
      connections: [...state.connections, conn],
      nextConnId: state.nextConnId + 1,
      totalCreated: state.totalCreated + 1,
    },
    conn,
  };
}

export function checkout(state: ConnectionPoolState): { state: ConnectionPoolState; conn: PooledConnection | null; waitTimeMs: number } {
  // Find idle
  const idleIdx = state.connections.findIndex((c) => c.state === "idle");
  if (idleIdx >= 0) {
    const conn = { ...state.connections[idleIdx], state: "in-use" as const, lastUsedAt: Date.now() };
    const connections = [...state.connections];
    connections[idleIdx] = conn;
    return {
      state: { ...state, connections, totalCheckouts: state.totalCheckouts + 1 },
      conn,
      waitTimeMs: 0,
    };
  }
  // Try to create a new one
  if (state.connections.length < state.maxSize) {
    const r = createConnection(state);
    const conn = { ...r.conn, state: "in-use" as const, lastUsedAt: Date.now() };
    return {
      state: { ...r.state, connections: r.state.connections.map((c) => c.id === conn.id ? conn : c), totalCheckouts: r.state.totalCheckouts + 1 },
      conn,
      waitTimeMs: 0,
    };
  }
  // Pool exhausted
  return { state, conn: null, waitTimeMs: 50 };
}

export function release(state: ConnectionPoolState, connId: string): ConnectionPoolState {
  const idx = state.connections.findIndex((c) => c.id === connId);
  if (idx < 0) return state;
  const conn = { ...state.connections[idx], state: "idle" as const, useCount: state.connections[idx].useCount + 1 };
  const connections = [...state.connections];
  connections[idx] = conn;
  return { ...state, connections };
}

export function closeConnection(state: ConnectionPoolState, connId: string): ConnectionPoolState {
  const idx = state.connections.findIndex((c) => c.id === connId);
  if (idx < 0) return state;
  const conn = { ...state.connections[idx], state: "closed" as const };
  const connections = [...state.connections];
  connections[idx] = conn;
  return { ...state, connections, totalClosed: state.totalClosed + 1 };
}

export function evictClosed(state: ConnectionPoolState): ConnectionPoolState {
  return { ...state, connections: state.connections.filter((c) => c.state !== "closed") };
}

export function poolStats(state: ConnectionPoolState): { idle: number; inUse: number; closed: number; utilization: number } {
  const idle = state.connections.filter((c) => c.state === "idle").length;
  const inUse = state.connections.filter((c) => c.state === "in-use").length;
  const closed = state.connections.filter((c) => c.state === "closed").length;
  const utilization = state.maxSize > 0 ? inUse / state.maxSize : 0;
  return { idle, inUse, closed, utilization };
}

/** Master metric: pool health 0-1. */
export function poolHealth(state: ConnectionPoolState): number {
  const stats = poolStats(state);
  if (state.maxSize === 0) return 0;
  // Healthy: low utilization + at least minSize idle
  const idleRatio = stats.idle / state.maxSize;
  const overflowPenalty = Math.max(0, stats.closed - state.minSize) * 0.1;
  return Math.max(0, Math.min(1, idleRatio * 0.7 + (1 - stats.utilization) * 0.3 - overflowPenalty));
}
