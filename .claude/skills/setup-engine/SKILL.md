---
name: setup-engine
description: "Upstream alias: this monorepo targets H5 + mini games, not Godot/Unity/Unreal. Invokes setup-web workflow instead."
argument-hint: "[ignored — use setup-web]"
user-invocable: true
allowed-tools: Read, Glob, Grep
---

When the user runs `/setup-engine` or selects this skill:

1. Explain that **aiGameGongfang** 已移除通用引擎 Agent，技术栈在 `STUDIO.md` 中维护。
2. Direct them to **`/setup-web`**（技能目录：`.claude/skills/setup-web/`，command id `setup-web`）以锁定 TypeScript Web 框架与目录。
3. 若需要微信 / 抖音初始化，分别使用 **`/setup-wechat-minigame`**、**`/setup-douyin-minigame`**。
4. Do **not** run the legacy Godot/Unity/Unreal engine matrix from the upstream template.

Upstream 完整引擎向导仍可在 `vendor/claude-game-studios/.claude/skills/setup-engine/SKILL.md` 查阅（仅供对照，勿与本仓库 `STUDIO.md` 混用）。
