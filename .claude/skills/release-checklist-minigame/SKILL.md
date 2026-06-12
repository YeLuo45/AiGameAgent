---
name: release-checklist-minigame
description: "Pre-submit checklist for WeChat and Douyin builds: artifacts, package size warnings, compliance reminders; not a substitute for store review."
argument-hint: "[wechat|douyin|both]"
user-invocable: true
allowed-tools: Read, Glob, Grep
---

## Input

Optional argument: `wechat`, `douyin`, or `both` (default **both**).

## Checklist (adapt to project)

1. **Version / changelog** — `release-manager` skill patterns; semver or platform-specific rules.
2. **Build outputs** — confirm `build:wechat` / `build:douyin` (once implemented) produce importable projects.
3. **API audit** — no undocumented `wx` / `tt` symbols (cross-check with `code-review`).
4. **Assets** — naming hooks from `.claude/hooks/validate-assets.sh` if enabled; respect subpackage limits.
5. **Privacy / permissions** — user-facing strings and data collection per latest platform policies (point to official checklists).

Output a Markdown checklist the human can paste into a release ticket; mark items that **require human verification** in the official developer console.
