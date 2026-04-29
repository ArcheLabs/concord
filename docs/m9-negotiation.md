# M9 协商机制

协商（Negotiation）是 Concord 协议中将行动意图（`ActionIntent`）转化为正式决策记录（`DecisionRecord`）的核心机制。本文档描述协议结构、收敛算法及 Fork 模式。

---

## 1. 概念模型

```
ActionIntent
    │
    ▼
NegotiationInstance ──── rounds[] ──── NegotiationRound
    │                                       └─── positions[] ──── NegotiationPosition
    │                                                               ├── stance: support|oppose|abstain|revise
    │                                                               ├── score?: number ∈ [0,1]
    │                                                               └── rationale, evidence
    │
    ▼  close()
DecisionRecord
    └── result: approved | rejected | needs_revision | escalated
```

---

## 2. 协议类型

### 2.1 代理快速投票（`delegate-fast-vote`）

适用于低风险、有委任代理人的场景。采用**仲裁投票**规则：

**输入参数**：
- $Q$：法定人数（quorum），最少需要几票才能有效
- $\theta$：通过阈值（threshold），$\in (0, 1]$

**决策规则**：

$$
\text{result} = \begin{cases}
\texttt{escalated} & \text{if } n_{\text{total}} < Q \\
\texttt{needs\_revision} & \text{if } n_{\text{revise}} > 0 \\
\texttt{approved} & \text{if } \dfrac{n_{\text{support}}}{n_{\text{total}}} \geq \theta \\
\texttt{rejected} & \text{otherwise}
\end{cases}
$$

默认参数：$Q = 1$，$\theta = 0.5$。

### 2.2 结构化协商（`simple-structured-negotiation`）

适用于需要多方深度参与的复杂决策。采用**评分收敛**规则（见第 3 节）。

---

## 3. 多轮收敛算法

### 3.1 参数

| 参数 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `maxRounds` | number | 3 | 最多进行几轮；超出后强制升级 |
| `convergenceThreshold` | number ∈ [0,1] | 0.7 | 评分均值达到该值视为收敛 |

### 3.2 单轮关闭逻辑

设第 $k$ 轮中提交了评分的立场集合为 $\mathcal{P}_k = \{i : s_i^{(k)} \text{ 已提交}\}$，计算均值：

$$
\bar{s}^{(k)} = \frac{1}{|\mathcal{P}_k|} \sum_{i \in \mathcal{P}_k} s_i^{(k)}
$$

决策规则：

$$
\text{result}^{(k)} = \begin{cases}
\texttt{approved} & \text{if } \bar{s}^{(k)} \geq \tau \\
\texttt{needs\_revision} & \text{if } \bar{s}^{(k)} < \tau \text{ and } k < R_{\max} \\
\texttt{escalated} & \text{if } \bar{s}^{(k)} < \tau \text{ and } k = R_{\max}
\end{cases}
$$

其中 $\tau$ = `convergenceThreshold`，$R_{\max}$ = `maxRounds`。

### 3.3 状态转移

```
collecting_positions
        │  submitPosition()
        ▼
     scoring
        │  close()
        ├──[approved]──────────────▶ converged  (closedAt 设置)
        ├──[needs_revision, k < R]──▶ revising   (新的第 k+1 轮自动打开)
        ├──[escalated]─────────────▶ failed      (closedAt 设置)
        └──[rejected]──────────────▶ closed      (closedAt 设置)
```

当结果为 `needs_revision` 时，`close()` 会：
1. 关闭当前轮（设置 `closedAt`）
2. 在 `rounds` 数组中追加新轮 `{ index: k+1, positions: [], openedAt: now }`
3. 将 instance 状态设为 `revising`
4. 触发事件 `NegotiationNewRoundOpened`

参与者随后可在新轮中重新提交立场。

### 3.4 示例：两轮收敛

```
轮 1: alice=0.5, bob=0.4  →  avg=0.45 < 0.7  →  needs_revision → 开启轮 2
轮 2: alice=0.8, bob=0.85 →  avg=0.825 ≥ 0.7 →  approved → converged
```

---

## 4. Fork 机制

### 4.1 用途

当协商陷入僵局，或需要探索不同参与者组合的平行路径时，可以将现有协商 Fork 出一个新分支。Fork 实例：

- 继承父协商的 `protocolId`、`actionId`、`topic`
- 拥有**独立**的 `participants`、`initiator`、`rounds`
- 通过 `parentNegotiationId` 保持与父协商的可追溯关联

### 4.2 数据结构

```typescript
interface ForkNegotiationInput {
  parentNegotiationId : NegotiationInstanceId
  newInitiator        : Actor
  participants        : Actor[]
  forkReason          : string
  context             : ContextReceipt
  maxRounds?          : number
  convergenceThreshold? : number
}
```

Fork 完成后触发 `NegotiationForked` 事件，payload 包含：
```json
{ "fork": NegotiationInstance, "parentNegotiationId": "...", "forkReason": "..." }
```

### 4.3 示例

```typescript
const fork = await negotiation.fork({
  parentNegotiationId: originalInstance.id,
  newInitiator: alternativeObserver,
  participants: [delegateA, delegateB],
  forkReason: "Original panel reached deadlock; reconvening with broader representation",
  context: newReceipt,
  convergenceThreshold: 0.6,  // 适当放宽收敛门槛
});
```

**Fork 与父协商相互独立**：对 Fork 的操作（提交立场、关闭）不影响父协商的状态。

### 4.4 HTTP 接口

```
POST /negotiations/:negotiationId/fork

Body:
{
  "newInitiatorId"       : string,
  "participantIds"       : string[],
  "forkReason"           : string,
  "maxRounds"?           : number,
  "convergenceThreshold"?: number
}

Response:
{ "negotiation": NegotiationInstance }
```

---

## 5. 事件列表

| 事件类型 | 触发时机 |
|---|---|
| `NegotiationStarted` | `create()` 成功 |
| `NegotiationPositionSubmitted` | `submitPosition()` 成功 |
| `NegotiationNewRoundOpened` | `close()` 结果为 `needs_revision`，自动开启下轮 |
| `NegotiationDecisionRecorded` | `close()` 产生最终决策（非 needs_revision） |
| `NegotiationForked` | `fork()` 成功 |
| `NegotiationClosed` | coordinator 层面的关闭确认事件 |

---

## 6. 与声誉系统的集成

`close()` 在写入决策后，若提供了 `projectId` 且注入了 `reputationService`，会自动调用 `writeReputationEvidence()` 完成声誉写回（详见 [m11-reputation.md](./m11-reputation.md) §4.4）。

```typescript
const { decision, instance } = await negotiation.close({
  negotiationId: id,
  projectId: "proj_xxx",   // 提供此字段才会触发声誉写回
});
```

---

## 7. 不变量

| 编号 | 描述 |
|---|---|
| INV-NEG-1 | `NegotiationInstance.rounds` 至少包含一轮 |
| INV-NEG-2 | `convergenceThreshold` $\in [0, 1]$ |
| INV-NEG-3 | `maxRounds` $\geq 1$ |
| INV-NEG-4 | Fork 实例的 `parentNegotiationId` 必须指向已存在的协商 |
| INV-NEG-5 | `close()` 只能在最后一轮（`rounds.at(-1)`）上操作 |
