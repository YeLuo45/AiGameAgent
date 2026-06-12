# Directory Structure

```text
/
├── STUDIO.md                    # Master configuration (本仓库入口；替代上游 CLAUDE.md)
├── .claude/                     # Agent definitions, skills, hooks, rules, docs
├── src/
│   ├── web/                     # H5 / 浏览器页游（无 wx、tt）
│   └── platforms/
│       ├── wechat/              # 微信小游戏
│       └── douyin/              # 抖音小游戏
├── packages/shared/             # 共享逻辑与类型（不直接引用平台全局）
├── assets/                      # Game assets (art, audio, vfx, shaders, data)
├── design/                      # Game design documents (gdd, narrative, levels, balance)
├── docs/                        # Technical documentation (architecture, api, postmortems)
│   └── engine-reference/        # Curated engine API snapshots (version-pinned)
├── tests/                       # Test suites (unit, integration, performance, playtest)
├── tools/                       # Build and pipeline tools (ci, build, asset-pipeline)
├── prototypes/                  # Throwaway prototypes (isolated from src/)
└── production/                  # Production management (sprints, milestones, releases)
    ├── session-state/           # Ephemeral session state (active.md — gitignored)
    └── session-logs/            # Session audit trail (gitignored)
```
