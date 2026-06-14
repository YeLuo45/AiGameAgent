// V28 ToolMCPServer (Direction B 28/30, generic-agent)
// JSON-RPC 2.0 MCP server exposing tool calls

export interface McpToolEntry {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface McpServerState {
  tools: McpToolEntry[];
  serverName: string;
  serverVersion: string;
}

export function createMcpServer(serverName: string = "ai-game-studio", serverVersion: string = "1.0.0"): McpServerState {
  return { tools: [], serverName, serverVersion };
}

export function registerMcpTool(state: McpServerState, tool: McpToolEntry): McpServerState {
  return { ...state, tools: [...state.tools, tool] };
}

export function unregisterMcpTool(state: McpServerState, name: string): McpServerState {
  return { ...state, tools: state.tools.filter((t) => t.name !== name) };
}

export function listMcpTools(state: McpServerState): McpToolEntry[] {
  return [...state.tools];
}

/** Handle an incoming JSON-RPC request. */
export function handleMcpRequest(state: McpServerState, req: McpRequest): McpResponse {
  switch (req.method) {
    case "tools/list": {
      return { jsonrpc: "2.0", id: req.id, result: { tools: state.tools } };
    }
    case "tools/call": {
      const toolName = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = state.tools.find((t) => t.name === toolName);
      if (!tool) {
        return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Tool not found: ${toolName}` } };
      }
      // In real impl, dispatch to executor. Here, return echo.
      return { jsonrpc: "2.0", id: req.id, result: { tool: toolName, args, status: "queued" } };
    }
    case "initialize": {
      return { jsonrpc: "2.0", id: req.id, result: { serverInfo: { name: state.serverName, version: state.serverVersion }, capabilities: { tools: {} } } };
    }
    default:
      return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } };
  }
}

export function buildMcpToolListResponse(state: McpServerState, id: string | number): McpResponse {
  return { jsonrpc: "2.0", id, result: { tools: state.tools } };
}

/** Master metric: MCP server readiness 0-1. */
export function mcpServerReadiness(state: McpServerState): number {
  if (state.tools.length === 0) return 0;
  return Math.min(1, state.tools.length / 5);
}
