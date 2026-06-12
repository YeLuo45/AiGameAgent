---
name: start-local
description: "Onboarding for OpenAI-compatible local LLM workflows: read STUDIO.md + local-llm skill, then mirror /start routing without Claude Code Slash UI."
argument-hint: "[no args]"
user-invocable: true
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

## When to use

User is driving the project from **Cursor** (or another IDE) with a **local** Chat Completions–compatible endpoint instead of Claude Code’s slash menu.

## Workflow

1. Ask the user to confirm `baseURL` and model (or read from their `docs/` / `.env.example` if you add one later).
2. Read **`STUDIO.md`** and **`.claude/skills/local-llm/SKILL.md`**; summarize constraints (no fictional `wx`/`tt`, file-write approval, task chunking).
3. Optionally run the same discovery steps as `.claude/skills/start/SKILL.md` (game concept presence, `src/` layout) **without** assuming `/slash` exists—refer to **skill names** as next actions:
   - Ideation → skill `brainstorm`
   - Web stack → skill `setup-web`
   - WeChat → `setup-wechat-minigame`
   - Douyin → `setup-douyin-minigame`
   - Ongoing delivery → `sprint-plan`, `code-review`, etc.
4. Never auto-run another skill; let the user invoke the next step explicitly.

## Command IDs

| Intent | Skill folder |
|--------|----------------|
| Local endpoint setup | `local-llm` |
| First onboarding (full) | `start` |
| This local-first wrapper | `start-local` |
