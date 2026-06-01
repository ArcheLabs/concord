# concord

Concord 是 Vibly 协调网络的**协议内核** — 一个以 TypeScript 为主的 pnpm monorepo，负责实现全部链下协调逻辑，并通过清晰的**适配器边界**连接到链上系统（Substrate、EVM）。

> **本仓库不包含 HTTP 服务器。** REST/SSE 网络网关由 [`vibly-coordinator`](../vibly-coordinator) 负责。依赖方向始终为 `vibly-* → concord`。当前对外 npm 表面中，被选中的协议包统一发布为 `@vibly-ai/concord-*`。

## 快速开始

```bash
pnpm install
pnpm build
pnpm test
pnpm demo    # 运行 MVP 演示循环（SDK CLI，无 HTTP 服务器）
```

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│                         @concord/sdk                         │
│            createConcord() / createSQLiteConcord()           │
└───────────────────────┬──────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   @vibly-ai/concord-core   @concord/state  @vibly-ai/concord-governance
   @vibly-ai/concord-foundation  @concord/negotiation  …
        │               │               │
        ▼               ▼               ▼
  adapter-substrate-actions  adapter-substrate-indexer
  （链上治理交易）                 （SubQuery GraphQL 查询）
```

## 包清单

### 协议核心

| 包 | 职责 |
|---|---|
| `@vibly-ai/concord-foundation` | 带品牌 ID、时间戳、规范 JSON、SHA-256、审计事件信封 |
| `@vibly-ai/concord-core` | 领域类型、Schema、服务端口、运行时/网关接口 |
| `@concord/state` | 内存和 SQLite 事件/投影存储 |
| `@concord/knowledge` | 知识候选、提交、版本管理 |
| `@concord/policy` | 动作策略注册表与路由 |
| `@concord/negotiation` | 委托快速投票与结构化协商 |
| `@concord/workflow` | 工作项、运行时分发、提交、审核、聚合 |
| `@concord/adapters` | Mock 运行时、脚本运行时、Mock 治理/资金网关 |
| `@concord/sdk` | `createConcord()` 和 `createSQLiteConcord()` 外观接口 |

### 扩展包

| 包 | 职责 |
|---|---|
| `@vibly-ai/concord-governance` | 治理端口接口（ActionsPort、IndexFeedPort、IndexQueryPort） |
| `@vibly-ai/concord-chain-indexing` | 通用链索引类型（ChainCheckpoint、NormalizedChainEvent、IndexCursor） |
| `@concord/external-input` | 外部输入服务 |
| `@concord/selection` | 选择服务、租约管理、故障转移 |
| `@concord/reputation` | 信誉证据服务 |
| `@concord/incentive` | 激励服务、资金/质押/定价网关 |
| `@concord/settlement` | 结算服务 |
| `@concord/trace` | 协议追踪、验证、重放 |
| `@concord/scenario` | 场景运行器 |
| `@concord/invariants` | 不变量检查 |
| `@concord/agent-directory` | 代理目录 |
| `@concord/trust-registry` | 信任注册表 |
| `@concord/coordination-view` | 协调视图 |
| `@concord/project` | 项目、目标、边界、委托人、成员 |

### 链适配器

| 包 | 职责 |
|---|---|
| `@vibly-ai/concord-adapter-substrate-actions` | `SubstrateGovernanceActionsAdapter` — 通过 polkadot-api (PAPI) 向 vibly-chain 提交治理交易 |
| `@vibly-ai/concord-adapter-substrate-indexer` | `SubQueryGovernanceIndexAdapter` — 查询 vibly-indexer SubQuery GraphQL，实现 GovernanceIndexFeedPort + GovernanceIndexQueryPort |
| `@concord/adapters-mock-ledger` | Mock 质押账本适配器，用于不连接真实链的测试 |

## SDK 扩展点

```ts
import { createConcord } from "@concord/sdk";

const concord = createConcord({
  // 可选的链适配器
  governanceIndexQuery: subQueryAdapter.query,    // GovernanceIndexQueryPort
  serviceChainActions: mySubstrateActionsAdapter, // ServiceChainActionsPort
});
```

## MVP 演示循环

`pnpm demo` 驱动完整的协议循环：

```
目标 → 观察者 → 上下文 → 动作 → 策略 → 协商 → 工作 → 运行时 → 审核 → 知识提交 → 状态更新
```

使用 SQLite 持久化：

```bash
pnpm --filter @concord/mvp-runner dev -- --db ./data/concord.db
```

使用本地脚本运行时：

```bash
pnpm --filter @concord/mvp-runner dev -- --runtime-script ./examples/runtime.js
```

脚本通过 stdin 接收 JSON 格式的任务，并须返回：

```json
{
  "submissionDraft": {
    "summary": "completed work",
    "artifacts": [{ "uri": "script://artifact" }]
  },
  "executionReceipt": { "status": "success" }
}
```

## 追踪与场景工具

```bash
pnpm concord scenario run examples/scenarios/simple-loop.yaml \
  --trace-out traces/simple-loop.trace.json --verify --replay
pnpm concord trace verify traces/simple-loop.trace.json
pnpm concord trace replay traces/simple-loop.trace.json
```

## 设计边界

事件日志是审计的事实来源；状态视图和动作表均为投影；知识只能通过 `KnowledgeCandidate → KnowledgeCommit → KnowledgeVersion` 流程正式化。

以下关注点通过端口接口和 Mock 适配器表达，**不在本仓库中实现**：

- EVM 合约、P2P 网络、Sybil 防御、Slash 裁决
- 网络协调 REST/SSE 网关（参见 `vibly-coordinator`）
- Web 控制台（参见 `vibly-console`）
- 链上代理运行时
- 真实 OpenGov 交易（由 `adapter-substrate-actions` 在 `papi add vibly-solo` 代码生成后提供）

### 分层不变量

- `@concord/*` 包不得依赖 Fastify、Express 或任何 HTTP 框架。
- `concord/apps/*` 不得暴露 HTTP 服务进程；仅允许 CLI/脚本演示。
- `concord/*` 不得依赖任何 Vibly 产品包；依赖箭头始终为 `vibly-* → concord`。本仓库里唯一允许出现的 `@vibly-ai/*` 名称，是以 `@vibly-ai/concord-` 开头的对外发布包。
- 本仓库内禁止使用产品命名空间标识符（`coordinator-api`、裸 `vibly-*`、`coordinator-*`），`@vibly-ai/concord-*` 发布前缀除外。

## 发布 checklist

当前对外发布的包集合为：

- `@vibly-ai/concord-foundation`
- `@vibly-ai/concord-core`
- `@vibly-ai/concord-chain-indexing`
- `@vibly-ai/concord-governance`
- `@vibly-ai/concord-adapter-substrate-actions`
- `@vibly-ai/concord-adapter-substrate-indexer`

发布前请执行 [docs/npm-publish-checklist.md](docs/npm-publish-checklist.md) 中的检查项。
