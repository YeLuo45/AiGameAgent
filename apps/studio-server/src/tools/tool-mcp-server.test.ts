// V28 ToolMCPServer (Direction B 28/30, generic-agent) - Tests
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMcpServer,
  registerMcpTool,
  unregisterMcpTool,
  listMcpTools,
  handleMcpRequest,
  buildMcpToolListResponse,
  mcpServerReadiness,
} from "./tool-mcp-server.js";

test("createMcpServer: empty", () => {
  const s = createMcpServer();
  assert.equal(s.tools.length, 0);
  assert.equal(s.serverName, "ai-game-studio");
});

test("registerMcpTool: adds", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "Read", description: "Read a file", parameters: {} });
  assert.equal(s.tools.length, 1);
});

test("unregisterMcpTool: removes", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "Read", description: "x", parameters: {} });
  s = unregisterMcpTool(s, "Read");
  assert.equal(s.tools.length, 0);
});

test("listMcpTools: returns all", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "a", description: "x", parameters: {} });
  s = registerMcpTool(s, { name: "b", description: "y", parameters: {} });
  assert.equal(listMcpTools(s).length, 2);
});

test("handleMcpRequest: initialize", () => {
  const s = createMcpServer();
  const r = handleMcpRequest(s, { jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.equal(r.jsonrpc, "2.0");
  assert.equal(r.id, 1);
  assert.ok((r.result as { serverInfo: unknown }).serverInfo);
});

test("handleMcpRequest: tools/list", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "Read", description: "x", parameters: {} });
  const r = handleMcpRequest(s, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal((r.result as { tools: unknown[] }).tools.length, 1);
});

test("handleMcpRequest: tools/call existing", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "Read", description: "Read a file", parameters: {} });
  const r = handleMcpRequest(s, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "Read", arguments: { path: "/a" } } });
  assert.ok(r.result);
  assert.equal((r.result as { status: string }).status, "queued");
});

test("handleMcpRequest: tools/call missing", () => {
  const s = createMcpServer();
  const r = handleMcpRequest(s, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "X", arguments: {} } });
  assert.equal(r.error?.code, -32601);
});

test("handleMcpRequest: unknown method", () => {
  const s = createMcpServer();
  const r = handleMcpRequest(s, { jsonrpc: "2.0", id: 5, method: "unknown" });
  assert.equal(r.error?.code, -32601);
});

test("buildMcpToolListResponse: returns tools", () => {
  let s = createMcpServer();
  s = registerMcpTool(s, { name: "x", description: "y", parameters: {} });
  const r = buildMcpToolListResponse(s, "abc");
  assert.equal(r.id, "abc");
  assert.equal((r.result as { tools: unknown[] }).tools.length, 1);
});

test("mcpServerReadiness: 0 empty", () => {
  assert.equal(mcpServerReadiness(createMcpServer()), 0);
});

test("mcpServerReadiness: 1.0 with 5+ tools", () => {
  let s = createMcpServer();
  for (let i = 0; i < 5; i++) s = registerMcpTool(s, { name: `t${i}`, description: "x", parameters: {} });
  assert.equal(mcpServerReadiness(s), 1.0);
});
