# concord

Concord 协议内核 — TypeScript-first pnpm monorepo，实现协调协议的链下逻辑，并通过 **adapter 边界** 连接真实的链上系统（OpenGov、EVM、Substrate）。

## 快速开始

```bash
pnpm install
pnpm build
pnpm test
pnpm demo    # 运行 MVP 演示循环
pnpm api     # 启动本地 HTTP API
```

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                         @concord/sdk                         │
│            createConcord() / createSQLiteConcord()           │
└───────────────────────┬──────────────────────────────────────┘
                        │ 依赖
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   @concord/core   @concord/state  @concord/governance
   @concord/foundation  @concord/negotiation  ...
        │               │               │
        ▼               ▼               ▼
  adapter-substrate-actions  adapter-substrate-indexer
  (链上治理操作, PAPI)        (SubQuery 链下索引查询)
```

## 包清单

### 核心协议包

| 包 | 职责 |
|---|---|
| `@concord/foundation` | 品牌化 ID、时间戳、canonical JSON、SHA-256、审计事件信封 |
| `@concord/core` | Concord 领域类型、schema、服务 port、运行时/网关接口 |
| `@concord/state` | 内存和 SQLite 事件/投影 store |
| `@concord/knowledge` | 知识候选、commit、版本管理 |
| `@concord/policy` | 行动策略注册表与策略路由 |
| `@concord/negotiation` | 委托快速投票、结构化协商 |
| `@concord/workflow` | 工作单、运行时分发、提交、评审、聚合 |
| `@concord/adapters` | mock 运行时、脚本运行时、mock 治理/资金网关 |
| `@concord/sdk` | `createConcord()` 和 `createSQLiteConcord()` 门面 |

### 扩展与状态包

| 包 | 职责 |
|---|---|
| `@concord/governance` | 治理 port 接口（GovernanceActionsPort, GovernanceIndexFeedPort, GovernanceIndexQueryPort） |
| `@concord/chain-indexing` | 通用链索引类型（ChainCheckpoint, NormalizedChainEvent, IndexCursor） |
| `@concord/external-input` | 外部输入服务 |
| `@concord/selection` | 选择服务、租约管理、故障转移 |
| `@concord/reputation` | 声誉证据服务 |
| `@concord/incentive` | 激励服务、资金/质押/价格网关 |
| `@concord/settlement` | 结算服务 |
| `@concord/trace` | 协议追踪、验证、重放 |
| `@concord/scenario` | 场景运行器 |
| `@concord/invariants` | 不变量检查 |
| `@concord/agent-directory` | Agent 目录 |
| `@concord/trust-registry` | 信任注册表 |
| `@concord/coordination-view` | 协调视图 |
| `@concord/project` | 项目、目标、边界、委托人、成员 |

### Chain-First Adapter 包

| 包 | 职责 |
|---|---|
| `@concord/adapter-substrate-actions` | `SubstrateGovernanceActionsAdapter` — 通过 polkadot-api (PAPI) 向 vibly-chain solo-node 提交治理交易 |
| `@concord/adapter-substrate-indexer` | `SubQueryGovernanceIndexAdapter` — 查询 vibly-indexer SubQuery GraphQL endpoint，实现 GovernanceIndexFeedPort + GovernanceIndexQueryPort |

## SDK 扩展点（ConcordConfig）

```ts
import { createConcord } from "@concord/sdk";

const concord = createConcord({
  // ... 原有配置 ...

  // Chain-First 可选适配器
  governanceIndexQuery: subQueryAdapter.query,   // GovernanceIndexQueryPort
  serviceChainActions: myServiceChainAdapter,     // ServiceChainActionsPort
});
```

## MVP 演示循环

`pnpm demo` 运行：

```
goal → observer → context → action → policy → negotiation → work → runtime → review → knowledge commit → state update
```

使用 SQLite 持久化：

```bash
pnpm --filter @concord/mvp-runner dev -- --db ./data/concord.db
```

使用本地脚本运行时：

```bash
pnpm --filter @concord/mvp-runner dev -- --runtime-script ./examples/runtime.js
```

脚本通过 stdin 接收 JSON，返回：

```json
{
  "submissionDraft": {
    "summary": "completed work",
    "artifacts": [{ "uri": "script://artifact" }]
  },
  "executionReceipt": { "status": "success" }
}
```

## M8 追踪与场景工具

```bash
pnpm concord scenario run examples/scenarios/simple-loop.yaml --trace-out traces/simple-loop.trace.json --verify --replay
pnpm concord trace verify traces/simple-loop.trace.json
pnpm concord trace replay traces/simple-loop.trace.json
```

- [Protocol Trace](docs/m8-protocol-trace.md)
- [Invariants](docs/m8-invariants.md)
- [Scenario Runner](docs/m8-scenario-runner.md)

## 设计边界

事件日志是审计源，状态视图和操作表是投影，知识只能通过 `KnowledgeCandidate → KnowledgeCommit → KnowledgeVersion` 形式化。

以下系统通过 port 接口和 mock adapter 表示，不在本 monorepo 中实现：

- EVM 合约、P2P 网络、sybil 防御、slash 裁决
- Web Console（见 `vibly-console`）
- 链上 agent 运行时
- 真实 OpenGov 交易（由 `adapter-substrate-actions` 提供，需运行 `papi add vibly-solo` codegen）
