# Concord 产品定义文档

版本：v0.1  
用途：供 Codex / 开发者理解产品，并作为后续代码架构设计的参考标准  
状态：产品定义草案，不是最终架构设计

---

## 1. 产品一句话定义

**Concord 是一个用于开放、不可信环境的 Agent 社会化协作框架。**

它通过状态一致性、知识一致性、结构化协商、行动策略、任务评审、激励适配和治理适配，使多个由不同主体运行的 Agent 能够围绕长期共同目标持续协作。

Concord 关注的不是单个 Agent 如何完成任务，而是：

> 多个 Agent 如何在没有中心化管理者、彼此不完全可信、运行有显式成本的环境下，形成持续协作秩序。

---

## 2. 产品不是什么

Concord 不是以下产品：

- 不是企业内部 Agent workflow
- 不是单 Agent runtime
- 不是普通任务管理系统
- 不是论坛、群聊或看板
- 不是某一条链的治理系统
- 不是 OpenGov / EVM Governor 的替代品
- 不是 MCP / A2A 的替代品
- 不是单纯的 DAO 工具

Concord 应该能够接入这些系统，但不应被它们定义。

---

## 3. 产品核心目标

Concord 的目标是支持多个 Agent 在开放环境中围绕长期共同目标运行。

它需要支持：

- 多 Agent 长期协作
- 不可信参与环境
- 可替换身份系统
- 可替换 Agent runtime
- 可替换状态观察来源
- 可替换知识库后端
- 可替换协商协议
- 可替换激励系统
- 可替换治理系统
- 可替换链上 / 链下执行系统

---

## 4. 产品核心问题

Concord 需要回答以下问题：

1. Agent 如何知道当前共同目标？
2. Agent 如何获得一致的系统状态？
3. Agent 如何共享一致的知识库？
4. Agent 如何观察系统状态和外部信息？
5. Agent 如何提出行动？
6. 行动如何决定是否需要协商、投票、评审或治理？
7. 协商如何结构化、可审计、可收敛？
8. 任务如何被生成、领取、执行和提交？
9. 结果如何被评审？
10. 激励如何被申请、预留、发放或惩罚？
11. 高风险行为如何被治理或暂停？
12. 系统如何进入下一轮观察和迭代？

---

## 5. 产品组成

Concord 当前应被理解为三个层次：

1. Concord SDK
2. Concord Client
3. Governance / Incentive Backend

---

## 6. Concord SDK

Concord SDK 是核心框架，面向开发者。

SDK 不应绑定任何具体业务、链、数据库、前端、Agent runtime 或治理系统。

SDK 提供的是一组通用协作抽象和接口。

### 6.1 SDK 应提供的能力

- Agent 节点客户端抽象
- 状态同步接口
- 知识同步接口
- 外部输入接口
- 行动意图模型
- Action Policy Registry
- 结构化协商模型
- 任务与提交模型
- 评审与验证模型
- 声誉证据模型
- 激励意图模型
- 治理请求模型
- 适配器接口

### 6.2 SDK 不应包含的内容

SDK 不应包含：

- Concord Chain 专属逻辑
- Polkadot OpenGov 具体实现
- EVM 合约 ABI
- DOT / VIB 价格曲线
- 具体数据库实现
- 具体前端 UI
- OpenClaw 具体运行逻辑
- A2A 具体协议实现
- Forum / Pod 具体产品逻辑
- 某个具体业务目标，例如“提升 Polkadot 采用率”

这些内容应位于上层应用或 adapter 中。

---

## 7. Concord Client

Concord Client 是基于 Concord SDK 构建的具体产品实例。

它是 Agent 运行 Concord 协作网络的客户端。

### 7.1 第一版职责

第一版 Concord Client 的最小职责是：

1. 接收任务
2. 同步上下文
3. 同步知识库版本
4. 调用 Agent runtime
5. 提交结果
6. 参与协商
7. 参与投票
8. 查看可领取任务
9. 提交执行回执
10. 同步状态更新

### 7.2 未来职责

未来 Concord Client 应支持：

- P2P 通信
- 本地状态缓存
- 本地知识库缓存
- 多 runtime 绑定
- 多链身份绑定
- 任务市场
- 协商可视化
- Agent 自主运行策略

### 7.3 Client 与 Server 的关系

第一版可以使用服务器协调。

但服务器应被理解为临时 Coordinator 实现，而不是 Concord 的永久权威中心。

未来应能够替换为：

- P2P 网络
- 链上事件驱动
- 多 coordinator 网络
- 混合协调模式

---

## 8. Coordinator

Coordinator 是协调服务。

第一版可以中心化实现。

### 8.1 Coordinator 职责

- 分发任务
- 选择观察者
- 选择候选观察者
- 选择代表
- 管理协商实例
- 聚合投票
- 聚合评审结果
- 维护状态视图
- 维护知识版本
- 广播上下文更新
- 记录事件日志

### 8.2 Coordinator 不应拥有的权力

Coordinator 不应成为不可替代的权威。

它不应单方面决定：

- 正式知识是否成立
- 重要行动是否通过
- 预算是否批准
- 奖励是否结算
- Agent 是否被 slash
- 高风险动作是否执行

这些应通过协商、代表投票、Guardian、链上治理或配置策略完成。

---

## 9. Governance / Incentive Backend

Concord 应支持不同治理与激励后端。

包括：

- Polkadot OpenGov
- Polkadot parachain
- EVM governance contract
- EVM escrow contract
- Polkadot 上的 EVM 合约
- 多签钱包
- 链下模拟账本

### 9.1 关键原则

SDK 不直接适配 OpenGov 或 EVM。

SDK 只定义治理、资金、质押、价格、结算等抽象接口。

OpenGov / EVM / 链下账本只是这些接口的实现。

### 9.2 典型接口

#### GovernanceGateway

用于提案、投票、执行、查询治理状态。

#### FundingGateway

用于预算申请、奖励预留、奖励领取、资金状态查询。

#### StakeGateway

用于质押状态、质押锁定、slash 请求。

#### PriceGateway

用于查询价格、预算估算、奖励估算。

---

## 10. OpenGov 抽象方式

OpenGov 不应进入 SDK 核心。

它应作为上层扩展包或 adapter 实现。

推荐拆分为：

- Governance Adapter：提案、投票、执行
- Treasury Adapter：预算、赏金、Tips、claim
- Identity / Stake Adapter：身份、质押、资格
- Price Adapter：DOT / VIB 价格参考

### 10.1 Concord 到 OpenGov 的映射

Concord 内部对象：

- ActionIntent
- FundingRequest
- RewardClaim
- SettlementIntent
- DecisionRecord
- GovernanceReceipt

OpenGov adapter 将这些对象映射为：

- OpenGov proposal
- vote
- bounty
- child bounty
- tip
- claim
- referendum status

### 10.2 设计原则

Concord SDK 关注：

- 谁提出 action
- action 需要什么批准
- 谁参与决策
- 决策如何形成
- 结果如何被记录
- 是否产生资金 / 治理 / 惩罚意图

OpenGov adapter 关注：

- 如何把这些意图变成 OpenGov proposal / vote / bounty / tip / claim

---

## 11. Agent Runtime Adapter

Concord 不应绑定某一种 Agent runtime。

应支持：

- OpenClaw
- A2A Agent
- Browser LLM
- Local LLM
- Hosted Agent
- Human-assisted Agent

### 11.1 Runtime Adapter 职责

- 接收 WorkOrder
- 接收 ContextBundle
- 调用具体 Agent 能力
- 返回 Submission
- 返回 ExecutionReceipt
- 返回 ContextReceipt

### 11.2 Runtime 不应决定

Runtime 不应决定：

- 任务是否通过
- 奖励是否发放
- 协商是否成立
- 知识是否正式提交

这些由 Concord 的协商、评审、治理和激励机制决定。

---

## 12. 状态观察 Adapter

Concord 中的观察可能来自不同系统。

例如：

- Polkadot 链上状态
- Ethereum 链上状态
- EVM 合约状态
- OpenGov 提案状态
- Forum 状态
- GitHub 状态
- 数据库状态
- 外部网页
- A2A Agent 输出

### 12.1 关键原则

观察来源是 adapter。

观察结果进入 Concord 后，不直接成为事实，而是成为可评审、可讨论、可沉淀的输入。

---

## 13. 知识库 Adapter

知识库是 Concord 的核心一致性机制之一。

但知识库后端应可替换。

可选实现包括：

- 文件系统
- 数据库
- 向量库
- IPFS
- 链上 hash
- 混合存储

### 13.1 知识正式性

知识不应直接写入正式知识库。

流程应为：

1. KnowledgeCandidate
2. Review / Validation
3. KnowledgeCommit
4. KnowledgeVersion
5. KnowledgeHash
6. KnowledgeSync

### 13.2 知识分层

知识库应至少区分：

- 启动知识
- 协议知识
- Skill
- 外部输入
- 候选知识
- 正式知识
- 废弃知识
- 争议知识

---

## 14. 核心工作模型

Concord 的基本工作模型是一个观察者驱动的嵌套协作循环。

### 14.1 基本循环

1. 同步状态
2. 同步知识库
3. 选取观察者和候选观察者
4. 观察者分析状态、知识和外部输入
5. 观察者提出行动
6. Action Policy Registry 判断行动所需流程
7. 根据策略进入代表投票、结构化协商、Guardian 审查或链上治理
8. 协商结果生成任务、计划、知识更新或治理请求
9. Agent 领取并执行任务
10. Reviewer 对结果进行评审
11. 系统更新状态视图、知识库和声誉证据
12. 进入下一轮观察

### 14.2 嵌套 Loop

一个 action 可能产生新的 loop。

例如：

- 观察者发现需要计划
- 计划需要协商
- 协商产生任务
- 任务执行后需要评审
- 评审产生知识更新
- 知识更新触发下一轮观察

因此 Concord 不是线性工作流，而是由 action 驱动的嵌套协作循环。

---

## 15. 角色模型

### 15.1 Observer

观察者是每轮循环的触发者。

职责：

- 观察状态
- 观察外部输入
- 识别问题
- 识别风险
- 提出行动
- 发起必要协商
- 生成观察汇报

限制：

- 不应单方面决定重要行动
- 不应单方面修改正式知识库
- 不应单方面发放奖励
- 不应单方面执行高风险动作

### 15.2 Candidate Observer

候选观察者用于容错。

当观察者超时、失败或行为异常时，候选观察者可接替。

### 15.3 Delegate

代表是临时审视者和轻量决策者。

职责：

- 审查观察者行为
- 对 action 进行快速投票
- 判断是否升级为协商
- 参与结构化协商
- 对需要投票的事项进行投票

### 15.4 Member

成员是普通参与 Agent。

职责：

- 同步知识库
- 同步状态
- 查看任务
- 领取任务
- 完成任务
- 参与协商
- 参与投票
- 参与评审

### 15.5 Guardian

Guardian 是高风险兜底角色。

职责：

- 审查高风险动作
- 暂停危险行为
- 处理重大越界行为
- 处理协议升级风险
- 处理资金风险

Guardian 不参与日常管理。

---

## 16. Action Policy Registry

Action Policy Registry 是 Concord 的关键组件。

它负责回答：

> 某个 action 应该经过什么流程，才能被执行？

### 16.1 示例

- 删除单条垃圾输入：代表快速投票
- 删除大量输入：强制协商
- 修改正式知识库：知识提交协议
- 创建计划：计划协商协议
- 申请预算：链上治理
- 领取奖励：提交证据并进入评审
- Slash：高门槛协商 + 可验证恶意证据
- 修改协商协议：root 协商协议

### 16.2 Policy 内容

一个 Action Policy 至少应描述：

- action 类型
- 发起权限
- 所需上下文
- 所需审批流程
- 投票规则
- 协商协议
- 是否需要 Guardian
- 是否需要链上执行
- 是否产生激励或惩罚意图
- 结果约束力

---

## 17. Structured Negotiation

协商是 Concord 的核心。

协商不是聊天，而是结构化、可审计、可自动化、可收敛的决策过程。

### 17.1 协商实例应包含

- 议题
- 发起者
- 参与者
- 背景上下文
- 支持意见
- 反对意见
- 弃权
- 打分
- 反驳
- 修订
- 阈值规则
- 收敛规则
- 决策记录
- 未解决问题
- 执行结果

### 17.2 协商协议

不同 action 可以使用不同协商协议。

例如：

- 快速代表投票
- 多轮战略讨论
- 计划评审
- 任务评审
- 知识提交评审
- 高风险升级
- root 协商协议

### 17.3 Root Negotiation Protocol

长期来看，新的协商协议可以由 Agent 提出。

但新协议不能直接生效。

它需要通过最严格的 root 协商协议注册。

MVP 阶段可以先不实现 Agent 自动生成协议，而使用配置式协议。

---

## 18. Human Request

Concord 需要支持系统层面对人类输出请求。

这不同于普通任务工件。

### 18.1 Human Request 类型

- FundingRequest
- GovernanceRequest
- GuardianRequest
- ExternalPublicationRequest
- HumanDecisionRequest
- EmergencyRequest

### 18.2 Human Request 应包含

- 请求原因
- 背景上下文
- 请求动作
- 风险说明
- 预算需求
- 相关证据
- 协商记录
- 预期结果

---

## 19. 一致性模型

Concord 不要求 Agent 彼此信任。

Concord 要求 Agent 使用一致上下文工作。

### 19.1 状态一致性

通过以下内容保证：

- EventCheckpoint
- StateViewVersion
- ContextBundle
- ContextReceipt

### 19.2 知识一致性

通过以下内容保证：

- KnowledgeVersion
- KnowledgeHash
- KnowledgeCommit
- KnowledgeSync

### 19.3 协议一致性

通过以下内容保证：

- ProtocolVersion
- ProtocolHash
- ProtocolInstance
- ActionPolicyVersion

### 19.4 提交一致性

Agent 提交结果时必须带回：

- ContextReceipt
- KnowledgeHash
- StateViewVersion
- ProtocolVersion
- ExecutionReceipt

如果上下文过期或不一致，提交可以被拒绝、降级或要求重跑。

---

## 20. 可靠性要求

Concord 应支持：

- 观察者失败替换
- 候选观察者接替
- 任务超时处理
- 任务失败重试
- 低质量输出评审
- 恶意行为标记
- 知识版本回滚
- 状态可追溯
- 高风险行为暂停
- 激励争议处理

---

## 21. 激励模型

Agent 的经济动机来自：

1. 质押义务奖励
2. 完成任务奖励
3. 项目预算申请
4. Tips / 追溯性奖励
5. 声誉提升
6. 更高概率成为观察者或代表
7. 更高概率获得任务

### 21.1 Slash 原则

Slash 必须谨慎。

需要区分：

- 超时
- 能力不足
- 低质量
- 误判
- 恶意删除
- 伪造证据
- 串谋评审
- 资金盗取

只有可证明恶意或严重违规才适合 slash。

---

## 22. Concord Chain 初步定位

Concord Chain 是 Concord 的一个具体治理与激励后端。

第一版重点：

- 质押
- 激励结算
- OpenGov
- 关键决策 hash
- DOT → VIB 单向兑换参考价格

### 22.1 暂不做

- 完整链上工作流
- 所有任务状态上链
- 所有知识内容上链
- 所有协商过程上链
- 复杂链上身份系统

### 22.2 DOT → VIB 价格发现

激励测试网阶段可通过 DOT → VIB 单向兑换形成参考价格。

资金进入多签钱包。

大部分资金未来用于流动性池。

该机制属于 Concord Chain / Concord Client 的具体实现，不应进入 Concord SDK 核心。

---

## 23. 最小不可替代能力

Concord 的最小不可替代能力是：

> 在不可信 Agent 网络中，将观察、协商、行动、评审、激励和知识一致性连接成一个可持续闭环。

这区别于：

- MCP：工具和资源接入
- A2A：Agent 间通信
- OpenGov：链上治理
- Forum：讨论界面
- Task Manager：任务管理
- Agent Runtime：单 Agent 执行

Concord 可以接入这些系统，但它的核心是将它们组织成一个长期协作框架。

---

## 24. MVP 范围建议

MVP 不应先实现完整开放社会系统。

MVP 应验证最小闭环：

1. 创建目标
2. 注册少量 Agent
3. 同步初始上下文
4. 选取观察者
5. 观察者提出 action
6. 代表投票或简单协商
7. 生成任务
8. Agent 执行任务
9. Reviewer 评审
10. 生成知识更新
11. 更新状态视图
12. 进入下一轮观察

### 24.1 MVP 应排除

- 完整 P2P
- 真实 OpenGov 深度集成
- 复杂 EVM 合约
- Agent 自动生成协商协议
- 大规模女巫防御
- 完整声誉系统
- 复杂 Forum / Pod
- 完整链上知识库

---

## 25. 架构设计约束

后续架构设计必须遵守以下约束：

1. SDK 不绑定 Concord Chain
2. SDK 不绑定 OpenGov
3. SDK 不绑定 EVM
4. SDK 不绑定具体数据库
5. SDK 不绑定具体 Agent runtime
6. SDK 不绑定具体协作 UI
7. 状态不是原语，而是事件和工件的投影
8. 知识必须版本化并有 hash
9. 重要 action 必须经过 Action Policy Registry
10. 协商必须结构化、可审计、可收敛
11. 观察者不能成为中心化管理者
12. 代表机制应可替换
13. Governance / Incentive / State / Runtime / Knowledge 都应通过 adapter 接入
14. 链只承载关键共识、激励和治理，不承载全部协作过程

---

## 26. 推荐代码层级

后续架构可参考以下层级，但不应过早细化。

### Foundation

最小技术原语。

例如：

- Id
- Ref
- Hash
- Version
- Timestamp
- EventEnvelope
- ArtifactRef
- SchemaRef
- Result
- Error

### Domain

Concord 通用协作抽象。

例如：

- Actor
- Input
- Context
- Knowledge
- Action
- Negotiation
- Work
- Review
- Incentive
- Governance

### Application

具体业务编排。

例如：

- Concord Client
- Polkadot Adoption
- EVM Maintenance
- Product Incubation

### Adapters

外部系统实现。

例如：

- OpenGov
- EVM
- A2A
- MCP
- OpenClaw
- Forum
- Pod
- Database
- Vector Store
- Knowledge Store

### Apps

部署入口。

例如：

- api
- worker
- web
- client
- mvp-runner

---

## 27. 术语表

### ActionIntent

Agent 或系统提出的行动意图。

### ActionPolicy

定义某类 action 需要经过何种审批、协商、投票或治理流程。

### ContextBundle

Agent 执行任务时接收的上下文包。

### ContextReceipt

Agent 提交结果时声明其使用了哪个上下文。

### KnowledgeHash

正式知识库某一版本的 hash。

### Structured Negotiation

结构化协商实例，用于处理分歧和形成可审计决策。

### Delegate

临时代表，用于轻量审查、投票和协商参与。

### Observer

每轮协作循环的观察者和行动建议者。

### Guardian

处理高风险行为的人类或高权限安全角色。

### GovernanceGateway

治理后端抽象接口。

### FundingGateway

预算、奖励、资金申请和领取接口。

### StakeGateway

质押和 slash 相关接口。

### PriceGateway

价格和预算估算接口。

---

## 28. 最终总结

Concord 的核心不是某个链、某个前端、某个 Agent runtime 或某个任务系统。

它的核心是：

> 在不可信 Agent 网络中，通过一致上下文、结构化协商、可审计行动、任务评审、知识同步、激励适配和治理适配，让多个 Agent 能够围绕长期目标持续协作。

Concord Client 是 Concord 的第一个具体产品实例。

Concord Chain 是 Concord 的一个治理与激励后端。

Concord SDK 则是让更多开发者能够构建类似系统的基础框架。
