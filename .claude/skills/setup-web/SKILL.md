---
name: setup-web
description: "Pin the browser H5 stack (TypeScript + chosen web game framework), align src/web/ and shared packages, and update STUDIO.md + technical-preferences.md."
argument-hint: "[framework hint] or no args"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, WebSearch
---

## Purpose

Configure the **Web** surface of the monorepo. This replaces the upstream `/setup-engine` flow for this project.

## Steps

1. **Read** `STUDIO.md` and `.claude/docs/technical-preferences.md`.
2. **If no framework chosen**, ask short questions: 2D vs 3D emphasis, bundle size sensitivity, team familiarity. Recommend Phaser, Cocos Web, or minimal Vite+Canvas—user selects.
3. **Update** `.claude/docs/technical-preferences.md`:
   - Web stack line with concrete framework + major version
   - Rendering / physics lines as applicable
4. **Update** `STUDIO.md` “技术栈” bullets to match (remove bracketed placeholders when values are known).
5. **Ensure directory contract** (create empty dirs + README if missing):
   - `src/web/`
   - `packages/shared/` (or `src/shared/` if that is the repo standard—pick one and stay consistent)
6. **Summarize** npm/pnpm scripts the user should add later (`dev`, `build`) without inventing unpublished CLI flags.

## Constraints

- No `wx` / `tt` in web-only paths.
- Cite official docs when adding dependencies; avoid hallucinated package names.
