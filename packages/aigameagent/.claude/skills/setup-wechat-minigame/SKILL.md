---
name: setup-wechat-minigame
description: "Scaffold or align WeChat mini game layout under src/platforms/wechat/; stress documented wx APIs only."
argument-hint: "[optional project name]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch
---

## Workflow

1. Read `STUDIO.md` and `design.md` / `openspec` notes if present for path conventions.
2. Ensure `src/platforms/wechat/` exists; add placeholder `README.md` describing import into **微信开发者工具**（本技能不代替官方工具）。
3. List required artifacts (e.g. `project.config.json`, game JSON) **only** per current WeChat documentation—if unsure, say so and point to official docs instead of inventing fields.
4. Wire npm scripts naming suggestion: `build:wechat` (implementation deferred to build tasks).
5. Remind: shared logic belongs in `packages/shared/`; platform bridge files stay under `wechat/`.

## API discipline

Every `wx` call must map to documented API surfaces; prefer project `types` or official typings if present.
