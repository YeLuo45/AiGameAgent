---
name: setup-douyin-minigame
description: "Scaffold or align Douyin/Byte mini game layout under src/platforms/douyin/; stress documented tt APIs only."
argument-hint: "[optional project name]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, WebFetch
---

## Workflow

1. Read `STUDIO.md` and platform design notes.
2. Ensure `src/platforms/douyin/` exists; document how to open the folder in **字节跳动开发者工具**（或当前官方工具名）。
3. Do **not** assume parity with WeChat—call out lifecycle/storage/auth differences when giving guidance.
4. Suggest `build:douyin` script name for future automation.
5. Shared gameplay code stays in `packages/shared/`; Douyin-specific adapters in `douyin/`.

## API discipline

Only use `tt` APIs supported by official Byte mini game documentation or repo typings.
