---
name: platform-diff
description: "Summarize WeChat vs Douyin mini game differences for this repo; link openspec and future docs/platform-wechat-vs-douyin.md when present."
argument-hint: "[topic optional]"
user-invocable: true
allowed-tools: Read, Glob, Grep, WebFetch
---

When invoked:

1. Read `openspec/changes/local-llm-h5-wechat-douyin-studio/specs/wechat-minigame/spec.md` and `.../douyin-minigame/spec.md` if available.
2. If `docs/platform-wechat-vs-douyin.md` exists, prefer it as the canonical table.
3. Produce a **short** delta: lifecycle hooks, storage, login, ad/network policies—**always** defer final behavior to platform official docs.
4. Flag code placement: `src/platforms/wechat` vs `src/platforms/douyin` vs `packages/shared`.

Do not invent SDK method names; quote doc sections or repo types only.
