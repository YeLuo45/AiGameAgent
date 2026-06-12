---
name: local-llm
description: "Use OpenAI-compatible endpoints (Ollama, vLLM, LM Studio) with this studio: base URL, model name, limits, and anti-hallucination rules for wx/tt APIs."
argument-hint: "[no args]"
user-invocable: true
allowed-tools: Read, Glob, Grep
---

## Configure the client

Point any OpenAI-compatible client at your local server:

- **Ollama**: `baseURL` `http://127.0.0.1:11434/v1`，`apiKey` 通常为占位字符串（依客户端要求）。
- **vLLM / LM Studio**：使用其文档中的 `/v1` 地址与端口。

Always set:

- A **model** string exactly as the server exposes it.
- Reasonable **max tokens** / timeouts for long Skills; split work when output truncates.

## Prompting norms (this repo)

1. Load **`STUDIO.md`** at session start when acting as a coding agent.
2. For WeChat / Douyin work, require **citations** to official docs or in-repo typings before accepting new API usage.
3. Treat `.claude/skills/*/SKILL.md` as workflow SOPs even when the UI has no Slash menu: the **skill `name`** field is the stable command id.

## Cursor / IDE notes

Set the editor’s custom OpenAI-compatible provider to the same `baseURL`. Cursor model dropdown labels vary by version; the important part is the HTTP compatibility, not the product name.
