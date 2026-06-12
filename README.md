# aiGameGongfang Studio

[English](README.en.md) | [日本語](README.ja.md)

面向 **HTML5 页游** 与 **微信/抖音小游戏** 的多端工作流仓库，配套一个 Web “工作室”界面，把不同“部门/角色”的 AI Agent 串成可控流程；AI 通过 **OpenAI 兼容 HTTP API** 连接本地或自建推理端点（如 Ollama / vLLM / LM Studio）。

## 运行

1) 安装依赖

```bash
npm install
```

2) 启动（服务端 + Web，一条命令）

```bash
npm run dev
```

默认地址：`http://127.0.0.1:8787`

也可以分别启动：

```bash
npm run dev:server
npm run dev:web
```

## 配置（不要提交密钥）

- 复制 `.env.example` 为 `.env` 按需填写
- 真实密钥、运行日志、本地依赖与构建产物已在 `.gitignore` 中默认忽略

## 目录

- `apps/studio-web/`: 工作室前端（等距办公室 + 面板）
- `apps/studio-server/`: 工作室后端（队列/事件日志/转发 OpenAI 兼容接口等）
- `packages/shared/`: 共享类型与事件定义
- `openspec/`: 规格/变更（OpenSpec 工作流）
- `production/`: 本地运行数据（默认 gitignore）

## 许可

本项目采用 **MIT License**，详见 `LICENSE`。

