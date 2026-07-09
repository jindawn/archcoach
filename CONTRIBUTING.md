# Contributing to ArchCoach

## 最简单的贡献：添加训练题

在 `scenarios/` 目录新建一个 markdown 文件即可，不需要写任何代码：

```markdown
---
slug: your-scenario-slug
title: 题目标题
difficulty: easy | medium | hard
domain: transaction | saas | ai | infra | ...
sortOrder: 10
constraints:
  qps: "..."
  teamSize: "..."
---
题目背景正文（Markdown）。写清楚业务上下文、真实的痛点、具体的数字，
以及"你需要设计…至少说清楚 1/2/3…"的作答要求。
```

好题目的标准：背景有真实感、约束有具体数字、考点能区分出方案好坏。
应用启动时会自动 seed（按 slug 幂等 upsert），改完文件重启即可看到。

## 开发环境

前置：Node 20+、pnpm 9+、Docker。

```bash
pnpm install
docker compose up postgres -d   # 只起数据库（host 端口 5433）
cp .env.example .env
pnpm db:migrate
pnpm dev
```

常用命令：`pnpm test`（单测，mock LLM）、`pnpm eval`（真实模型质量门）、
`pnpm lint` / `pnpm typecheck`、`pnpm db:studio`。

## 修改 Prompt

`prompts/` 下所有模板受版本管理：

1. 任何修改必须递增 frontmatter 中的 `version` 字段（会写入每次调用的审计日志）。
2. PR 描述中附上 `pnpm eval` 修改前后的对比结果。

## 架构边界（请遵守）

- `src/core/` 是评审引擎，**禁止 import next / react / @/db**（有 ESLint 规则拦截）。
  持久化通过 core 内定义的接口注入。它未来会被抽成独立包（CLI / MCP server）。
- 评分与等级封顶是确定性代码（`src/core/scoring`），不要把裁决逻辑挪进 prompt。

## 提交规范

- Conventional Commits：`feat:` `fix:` `docs:` `test:` `refactor:` `chore:`
- PR 需通过 CI（lint + typecheck + test + build）
- 一个 PR 解决一件事
