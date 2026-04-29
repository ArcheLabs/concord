# M11 声誉系统

声誉系统为 Concord 协议中的每个参与者（Actor）维护一个可信度度量，用于指导 **M11 选举**（`@concord/selection`）和 **M13 激励结算**（`@concord/incentive`）。

---

## 1. 核心数据模型

### 1.1 证据（ReputationEvidence）

每次可审计的行为都会产生一条证据记录：

```
ReputationEvidence {
  actorId     : ActorId
  projectId   : ProjectId
  kind        : ReputationEvidenceKind   // 见下表
  score       : number   // ∈ [-1, 1]，正值 = 有利信号
  weight      : number   // > 0，默认 1.0
  createdAt   : Timestamp
}
```

| kind | 触发场景 | 典型 score |
|---|---|---|
| `work_accepted` | 提交被接受 | +1 |
| `work_rejected` | 提交被拒绝 | -1 |
| `review_accurate` | 评审结论与多数一致 | +0.2 |
| `review_inaccurate` | 评审结论与多数相悖 | -0.2 |
| `delegate_participated` | 在协商中提交了立场 | +0.3 |
| `delegate_non_response` | 协商超时未响应 | -0.2 |
| `delegate_revision_accepted` | 修订请求促成了最终收敛 | +0.2 |
| `review_consensus_deviation` | 评分与同伴均值偏差过大 | -(deviation × 0.5) |
| `knowledge_committed` | 提名知识片段被提交 | +0.5 |
| `failover_triggered` | 触发故障转移（被替换） | -0.3 |
| `slash` | 严重违规 | 可配置 |
| `tip` | 社区表彰 | 可配置 |

---

## 2. 静态加权平均评分

### 2.1 定义

给定参与者 $i$ 在项目 $p$ 下的全部证据集合 $\mathcal{E}_{i,p}$，静态声誉评分定义为：

$$
R_i = \text{clamp}\!\left(\frac{\sum_{e \in \mathcal{E}_{i,p}} s_e \cdot w_e}{\sum_{e \in \mathcal{E}_{i,p}} w_e},\ -1,\ 1\right)
$$

其中 $s_e \in [-1,1]$ 为单条证据的得分，$w_e > 0$ 为其权重。

### 2.2 实现

```typescript
// @concord/reputation — InMemoryReputationEvidenceService.getScore()
const score = await reputationService.getScore(actorId, projectId);
score.normalizedScore  // ∈ [-1, 1]
```

**特性**：简单、可解释，但对历史上的单次爆发（大量 +1 或 -1）敏感，且不会随时间自然衰减。

---

## 3. 指数移动平均评分（EMA）

### 3.1 动机

静态平均将所有历史证据等权处理，导致"刷声誉"攻击有效——早期大量正向证据可以永久拉高评分。EMA 引入时间衰减以修正此问题。

### 3.2 递推定义

按 `createdAt` 时间升序遍历证据，维护 EMA 状态 $\hat{R}$，初始值为 0：

$$
\hat{R}_t = (1 - \lambda)\,\hat{R}_{t-1} + \lambda \cdot s_t \cdot w_t
$$

最终评分：

$$
R_i^{\text{EMA}} = \text{clamp}(\hat{R}_T,\, -1,\, 1)
$$

| 参数 | 含义 | 默认值 |
|---|---|---|
| $\lambda$ | 衰减因子（decay factor）| 0.1 |

- $\lambda$ 越小，历史记忆越长（旧证据权重衰减慢）。
- $\lambda$ 越大，对最近行为响应越灵敏。

### 3.3 实现

```typescript
// @concord/reputation — InMemoryReputationEvidenceService.getEmaScore()
const score = await reputationService.getEmaScore(actorId, projectId, /* λ= */ 0.1);
score.normalizedScore  // ∈ [-1, 1]
```

---

## 4. 同伴预测一致性评分（Peer Prediction）

### 4.1 动机

当多个评审员对同一提案打分时，存在"均值操纵"风险：若所有人知道均值将成为基准，理性行为是报告接近均值的分数而非真实判断（即 [cheap talk](https://en.wikipedia.org/wiki/Cheap_talk)）。

Peer Prediction 通过**留一法均值**（leave-one-out mean）作为参照，激励每个人如实报告：

> 对参与者 $i$ 而言，其报酬乘数仅取决于与**其他人均值**的偏差，而非与真实值的偏差——从而避免了对"正确答案"的循环依赖。

### 4.2 形式化定义

设第 $k$ 轮协商中共有 $n$ 位评审员，各自报告分数 $s_1, \dots, s_n \in [0, 1]$。

对评审员 $i$，定义：

$$
\bar{s}_{-i} = \frac{1}{n-1} \sum_{j \neq i} s_j \quad \text{（同伴均值，不含自身）}
$$

$$
\delta_i = \min\!\left(1,\; |s_i - \bar{s}_{-i}|\right) \quad \text{（归一化偏差）}
$$

$$
m_i = 1 - \delta_i \quad \in [0,1] \quad \text{（激励乘数）}
$$

**边界情况**：
- $n = 1$：无同伴可比，令 $m_i = 1$（不惩罚唯一的评审员）。
- 所有人报告相同分数：$\delta_i = 0$，$m_i = 1$（满分乘数）。

### 4.3 实现

```typescript
// @concord/reputation — ConsistencyScorer
import { ConsistencyScorer } from "@concord/reputation";

const scorer = new ConsistencyScorer();
const results = scorer.score([
  { actorId: alice, score: 0.9 },
  { actorId: bob,   score: 0.9 },
  { actorId: carol, score: 0.1 },  // 离群
]);
// carol:  peerMean=0.9, deviation=0.8, multiplier=0.2
// alice:  peerMean=0.5, deviation=0.4, multiplier=0.6

// @concord/incentive — ReviewerPayoffCalculator
import { ReviewerPayoffCalculator } from "@concord/incentive";

const calc = new ReviewerPayoffCalculator();
const multipliers = calc.computeMultipliers([
  { actorId: alice, score: 0.9 },
  { actorId: bob,   score: 0.9 },
]);
// multipliers.get(alice) → 1.0 (完全一致)
```

### 4.4 自动写回

`InMemoryNegotiationService.close()` 在协商结束时自动调用 `ConsistencyScorer`，并将结果写入声誉证据：

- 偏差 $\delta_i > 0.3$ → 写入 `review_consensus_deviation`，score $= -0.5 \cdot \delta_i$
- 支持了最终收敛的提案 → 写入 `delegate_participated`，score $= +0.3$
- 修订请求促成了收敛 → 写入 `delegate_revision_accepted`，score $= +0.2$
- 未响应的参与者 → 写入 `delegate_non_response`，score $= -0.2$

---

## 5. 声誉评分在选举中的使用

`@concord/selection` 的 `reputation_weighted` 策略使用**加权随机采样**而非确定性选最优：

$$
P(\text{选中}\ i) = \frac{\max(0,\, R_i)}{\sum_{j} \max(0,\, R_j)}
$$

这防止了单一高声誉参与者通过确定性规则永久垄断角色，同时仍给予声誉良好者更高的期望当选次数。

---

## 6. 不变量

| 编号 | 描述 |
|---|---|
| INV-REP-1 | 单条证据的 score 必须 $\in [-1, 1]$ |
| INV-REP-2 | 单条证据的 weight 必须 $> 0$ |
| INV-REP-3 | 最终归一化评分 $R_i \in [-1, 1]$（由 clamp 保证） |
