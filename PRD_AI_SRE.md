# AI SRE 管理系统 · 产品需求文档 v1

> **一句话定位**：面向中大型技术团队的 AI 驱动站点可靠性工程管理平台，用 AI Agent 替代 80% 的重复性运维决策，让 On-Call 从"救火"变成"监督"。

---

## 1. 背景与动机

- **行业痛点**：
  - On-Call 工程师每天被大量告警淹没，告警疲劳导致真正严重的问题被忽略。
  - 故障排查依赖个人经验，新人 On-Call 上手周期长（3-6 个月）。
  - 事后复盘（Postmortem）耗时且质量参差，同类故障反复发生。
  - 运维知识散落在 Slack/飞书/Confluence 中，检索困难。
  - 变更风险难以量化，回滚决策依赖直觉。
- **AI 供给优势**：LLM 已能理解日志语义、生成 Runbook、总结故障时间线、评估变更风险。Agent 框架（LangChain/AutoGen）可编排多步骤运维操作。
- **商业模型**：SaaS 订阅制，按纳管的集群/节点/服务规模计费。免费版覆盖 5 个服务 + 1 个 On-Call 用户。

## 2. 目标用户

| 画像 | 痛点 | 决策权 |
|---|---|---|
| **P0：SRE / DevOps 工程师** | 告警太多、排查太慢、值班太累 | 日常使用者 |
| **P0：SRE Manager / VP of Infrastructure** | MTTD/MTTR 指标差、团队 burnout、预算不可控 | 采购决策者 |
| **P1：Backend 开发工程师** | 不知道自己的服务是否健康、出问题不知道找谁 | 间接用户 |
| **P2：CTO / VP of Engineering** | 全局稳定性可见性差、事故影响业务 | 战略审批者 |

## 3. 核心产品原则

1. **Agent-First, Human-in-the-Loop**：AI Agent 自主执行诊断、修复建议、甚至自动回滚，但关键操作（如生产环境变更）必须人类确认。
2. **Single Pane of Glass**：一个界面看全栈健康度——基础设施 → 容器 → 应用 → 业务指标。
3. **Noise Reduction by Default**：告警必须经过 AI 去重、聚合、优先级排序后才触达人。
4. **Knowledge Accumulation**：每次故障处理自动沉淀为知识库条目，让系统越用越聪明。
5. **API-First / ChatOps-Native**：所有操作既可通过 Web UI 完成，也可通过 Slack/飞书/钉钉 Bot 对话完成。

## 4. 系统架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    AI SRE Platform                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Incident │  │  Alert   │  │  Change  │  │ Capacity │ │
│  │ Manager  │  │Intelligence│ │  Guard   │  │ Planner  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │             │             │             │        │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐   │
│  │              AI Agent Engine                       │   │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │   LLM   │  │  Tool    │  │  Knowledge Base  │  │   │
│  │  │ Router  │  │ Executor │  │     (RAG)        │  │   │
│  │  └─────────┘  └──────────┘  └──────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                │
│  ┌───────────────────────┴────────────────────────────┐   │
│  │              Integration Layer                      │   │
│  │  PagerDuty │ OpsGenie │ Grafana │ Datadog │ K8s   │   │
│  │  Prometheus│  ELK     │  Jaeger │  Slack  │  Jira │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 5. 功能模块

### 5.1 智能告警管理（Alert Intelligence）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **多源告警接入** | 对接 PagerDuty、OpsGenie、Grafana Alerting、Prometheus AlertManager、Datadog、自研 Webhook | P0 |
| **AI 告警去重与聚合** | 同一根因的多个告警自动合并为一个 Incident；基于时间窗口 + 拓扑关系 + 语义相似度 | P0 |
| **智能降噪** | 自动识别已知误报（基于历史标记）、低频抖动、维护窗口内告警，静默处理 | P0 |
| **告警优先级动态调整** | 结合业务影响面（受影响用户数/交易量）+ 服务依赖拓扑，自动升级/降级 | P1 |
| **告警摘要** | 每个聚合后的 Incident 生成一句话摘要 + 影响范围 + 建议处理人 | P0 |

### 5.2 故障响应与诊断（Incident Manager）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **AI 自动诊断** | 故障触发后，Agent 自动拉取相关日志（ELK/Loki）、Metrics（Prometheus/Grafana）、Trace（Jaeger/Tempo）、最近变更记录，生成诊断报告 | P0 |
| **根因分析（RCA）** | 基于多维度数据关联 + 历史相似故障匹配，给出根因假设（带置信度） | P0 |
| **智能 Runbook 推荐** | 匹配历史相似 Incident 的处理记录，推荐最佳 Runbook 步骤 | P0 |
| **自动修复（Auto-Remediation）** | 对已知模式（如 OOM → 重启 Pod、磁盘满 → 清理日志）自动执行修复，需配置审批策略 | P1 |
| **故障时间线** | 自动生成 Incident 完整时间线：首次异常 → 告警触发 → 响应 → 诊断 → 修复 → 恢复 | P0 |
| **War Room 协作** | 一键创建临时沟通频道（Slack/飞书）+ 视频会议 + 共享诊断面板 | P1 |
| **多级升级策略** | 基于严重级别 + 响应超时自动升级到高级 On-Call / Manager | P1 |

### 5.3 变更风险管控（Change Guard）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **变更风险评分** | 部署前 AI 评估：代码 Diff 分析 + 变更范围（影响的服务/API）+ 历史相似变更的故障率 → 风险分数（0-100） | P0 |
| **变更窗口建议** | 基于历史流量低谷 + 团队 On-Call 排班，推荐最佳变更时间 | P1 |
| **自动回滚检测** | 部署后自动对比关键指标（错误率、延迟、吞吐量）的基线，异常时建议/自动回滚 | P0 |
| **变更日历** | 团队变更统一视图，冲突检测（多人同时改同一服务） | P1 |
| **冻结期管理** | 支持设置变更冻结窗口（如大促、节假日），冻结期内变更需额外审批 | P2 |

### 5.4 容量规划与成本优化（Capacity Planner）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **资源预测** | 基于历史用量趋势 + 业务增长预测，预估未来 7/30/90 天的 CPU/内存/存储需求 | P1 |
| **弹性伸缩建议** | 分析 HPA/VPA 配置是否合理，给出优化建议 | P1 |
| **闲置资源识别** | 自动发现低利用率节点、孤儿资源（未挂载的磁盘、未使用的 LB）、可缩容的副本 | P1 |
| **成本归因** | 按服务/团队/环境拆分云成本，识别成本异常增长 | P2 |
| **FinOps 报告** | 每周自动生成成本优化报告 + 预估节省金额 | P2 |

### 5.5 值班管理（On-Call Manager）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **智能排班** | 基于团队成员时区、偏好、历史值班负荷，自动生成最优排班表 | P1 |
| **值班负载均衡** | 统计每人每周被唤醒次数/处理 Incident 数，避免某人过载 | P1 |
| **交接摘要** | 值班结束自动生成交接摘要：本周期 Incident 概览 + 待处理项 + 风险提示 | P1 |
| **疲劳度监控** | 检测连续被唤醒次数/睡眠中断频率，超阈值自动触发备用 On-Call | P2 |

### 5.6 事后复盘与知识沉淀（Postmortem & Knowledge Base）

| 功能 | 描述 | 优先级 |
|---|---|---|
| **自动 Postmortem 生成** | Incident 关闭后，AI 基于时间线 + 诊断报告 + 处理记录，自动生成 Postmortem 草稿 | P0 |
| **Action Item 追踪** | 从 Postmortem 中自动提取 Action Items，同步到 Jira/Linear，追踪完成状态 | P0 |
| **故障模式库** | 积累历史故障的特征向量，新故障自动匹配相似历史案例 | P1 |
| **智能知识库** | RAG 驱动的运维知识库，支持自然语言查询（如"数据库连接池耗尽怎么处理？"） | P0 |
| **可靠性评分** | 每个服务基于故障频率/MTTR/变更失败率等计算可靠性评分（0-100） | P1 |

### 5.7 ChatOps 智能助手

| 功能 | 描述 | 优先级 |
|---|---|---|
| **自然语言查询** | "本周哪些服务出过故障？" "帮我查一下 payment-service 最近 24 小时的错误日志" | P0 |
| **对话式诊断** | "payment-service 现在 5xx 错误率飙升，帮我排查" → Agent 自动执行诊断流程并汇报 | P0 |
| **一键操作** | "把 user-service 扩容到 10 个副本" "回滚 payment-service 到上一个版本" | P1 |
| **订阅推送** | 自定义订阅规则（如"当 production 任何服务 P99 延迟 > 1s 时通知我"） | P1 |

### 5.8 SLO/SLI 管理

| 功能 | 描述 | 优先级 |
|---|---|---|
| **SLO 定义与追踪** | 为每个服务定义 Availability/Latency/Error Rate SLO，实时追踪燃尽率 | P0 |
| **Error Budget 策略** | 基于 Error Budget 消耗速度，自动决策：冻结变更 vs 允许变更 | P1 |
| **SLO 看板** | 全局 SLO 健康度仪表盘，一眼看出哪些服务在"烧钱" | P0 |

## 6. 数据模型（核心表）

```sql
-- 租户/团队
tenants             id / name / plan / created_at

-- 纳管的资源
managed_resources   id / tenant_id / kind('k8s_cluster'|'service'|'database'|'cache'|'queue') 
                    / name / namespace / metadata(JSON) / created_at

-- 告警源
alert_sources       id / tenant_id / type('pagerduty'|'grafana'|'prometheus'|'datadog'|'webhook')
                    / name / config(JSON) / is_active / created_at

-- 原始告警
raw_alerts          id / tenant_id / source_id / external_id / title / description / severity
                    / status / labels(JSON) / fired_at / resolved_at

-- 聚合后的故障（Incident）
incidents           id / tenant_id / title / summary / severity / status('open'|'acknowledged'|'investigating'|'mitigated'|'resolved')
                    / ai_diagnosis(TEXT) / ai_root_cause(TEXT) / ai_confidence / 
                    / affected_services(JSON) / timeline(JSON) / created_at / resolved_at

-- Incident ↔ Alert 关联
incident_alerts     incident_id / alert_id (PK 复合)

-- 变更记录
changes             id / tenant_id / service_id / type('deploy'|'config'|'infra') / description
                    / diff_summary / risk_score / status / requester / approved_by / 
                    / deployed_at / rolled_back_at

-- 值班排班
on_call_schedules   id / tenant_id / user_id / start_at / end_at / level('primary'|'secondary')

-- 事后复盘
postmortems         id / tenant_id / incident_id / title / summary / timeline / root_cause
                    / impact / resolution / action_items(JSON) / ai_generated / created_at

-- 知识库条目
knowledge_entries   id / tenant_id / title / content / tags(JSON) / embedding(VECTOR) 
                    / source_incident_id / created_at

-- SLO 定义
slos                id / tenant_id / service_id / name / metric_type / target / window_days
                    / current_burn_rate / created_at
```

## 7. AI Agent 引擎设计

### 7.1 Agent 类型

| Agent | 触发条件 | 能力 |
|---|---|---|
| **Triage Agent** | 新告警到达 | 去重聚合 → 严重级别判定 → 生成摘要 → 指派处理人 |
| **Diagnosis Agent** | Incident 创建 | 拉取日志/Metrics/Trace → 关联分析 → 生成诊断假设 |
| **Remediation Agent** | 诊断完成 + 匹配到已知模式 | 推荐/执行 Runbook → 验证修复效果 |
| **Postmortem Agent** | Incident 关闭 | 汇总时间线 → 分析根因 → 生成 Postmortem → 提取 Action Items |
| **Change Risk Agent** | 变更请求提交 | Diff 分析 → 影响面评估 → 风险评分 → 审批建议 |
| **Capacity Agent** | 定时（每日） | 用量趋势分析 → 预测 → 优化建议 |

### 7.2 Tool Set（Agent 可调用的工具）

```
- query_logs(source, service, time_range, query) → 日志查询
- query_metrics(source, metric, service, time_range) → 指标查询
- query_traces(service, trace_id) → 链路追踪
- get_topology(service) → 服务依赖拓扑
- get_recent_changes(service, time_range) → 近期变更列表
- search_knowledge_base(query) → 知识库 RAG 检索
- search_similar_incidents(incident_id) → 相似历史故障
- execute_runbook(runbook_id, params) → 执行 Runbook（需审批）
- rollback_service(service, version) → 回滚服务（需审批）
- scale_service(service, replicas) → 扩缩容（需审批）
- create_jira_ticket(summary, description) → 创建 Jira 工单
- send_slack_message(channel, message) → 发送 Slack 消息
```

### 7.3 Human-in-the-Loop 审批策略

| 操作 | 审批要求 |
|---|---|
| 查询类（日志/指标/Trace） | 无需审批 |
| 诊断报告生成 | 无需审批 |
| 告警静默/去重 | 无需审批 |
| Runbook 推荐 | 无需审批 |
| **自动执行 Runbook（生产环境）** | **必须人工确认** |
| **回滚服务** | **必须人工确认** |
| **扩缩容** | **必须人工确认** |
| **非生产环境自动修复** | 可配置为自动执行 |

## 8. MVP（P0）交付范围

### 8.1 MVP 功能清单

- [x] 多源告警接入（PagerDuty + Grafana + Webhook）
- [x] AI 告警去重聚合 + Incident 自动创建
- [x] AI 自动诊断（日志 + Metrics 拉取分析）
- [x] 根因分析 + 置信度展示
- [x] 智能 Runbook 推荐（基于历史匹配）
- [x] 故障时间线自动生成
- [x] 变更风险评分 + 自动回滚检测
- [x] 自动 Postmortem 生成 + Action Item 提取
- [x] RAG 智能知识库
- [x] ChatOps 自然语言查询 + 对话式诊断
- [x] SLO 定义与追踪 + 全局看板
- [x] 全局健康度仪表盘

### 8.2 MVP 不包含（P1/P2）

- 自动修复（Auto-Remediation）
- War Room 协作
- 容量规划与成本优化
- 值班管理（排班/负载均衡）
- 疲劳度监控
- 变更日历与冻结期管理

## 9. 技术栈建议

| 层 | 技术 | 备注 |
|---|---|---|
| 前端 | Next.js 16 + React 19 + TypeScript | App Router |
| 样式 | Tailwind CSS 4 | 暗色 Terminal 风格（类 Datadog/Grafana） |
| 数据库 | PostgreSQL 15 + pgvector | 向量存储知识库 embedding |
| 缓存 | Redis | 告警去重窗口、实时指标缓存 |
| 消息队列 | Kafka / Redis Streams | 告警流处理 |
| AI | OpenAI-compatible API（GPT-4o / Claude Sonnet） | Agent 引擎 |
| Agent 框架 | LangChain / Vercel AI SDK | 工具编排 |
| 部署 | Docker + Kubernetes | 自身也跑在 K8s 上 |
| 认证 | NextAuth.js (GitHub/Google SSO + SAML) | 企业用户 SSO |

## 10. 视觉方向

- **风格**：Datadog / Grafana 风格 —— 深色底 + 高对比度 + 数据密度高
- **色调**：暗色背景 `#0a0a0e` + 绿色 `#00ff88`（健康）/ 红色 `#ff4444`（故障）/ 琥珀 `#ffaa00`（警告）
- **字体**：等宽字体 JetBrains Mono / Fira Code（日志/代码区），Inter（UI 区）
- **布局**：左侧导航 + 顶部全局搜索 + 主内容区（仪表盘/列表/详情）

## 11. 成功指标（MVP 上线 90 天）

| 指标 | 目标 |
|---|---|
| 接入团队数 | ≥ 10 |
| 日均处理告警量 | ≥ 1000 |
| AI 诊断准确率（根因 Top-3 命中） | ≥ 80% |
| 告警降噪率（聚合后告警数 / 原始告警数） | ≤ 30% |
| MTTD（Mean Time to Detect）降低 | ≥ 40% |
| MTTR（Mean Time to Resolve）降低 | ≥ 30% |
| Postmortem 生成时间节省 | ≥ 70% |
| NPS | ≥ 50 |

## 12. 竞品分析

| 产品 | 优势 | 劣势 |
|---|---|---|
| **PagerDuty** | 告警管理成熟、生态丰富 | 无 AI 诊断、无知识库、无变更风险评估 |
| **Datadog** | 全栈可观测性 | AI 能力弱（仅异常检测）、无 Postmortem 自动化 |
| **Incident.io** | Slack-native Incident 管理 | 无 AI 诊断、无变更管理、无容量规划 |
| **FireHydrant** | Incident 流程 + Postmortem | AI 能力有限、无主动诊断 |
| **Rootly** | Incident 管理 + Jira 集成 | AI 能力弱 |
| **AI SRE（本产品）** | **全流程 AI Agent 覆盖**：诊断→修复→复盘→知识沉淀 | 新产品，生态集成深度待建设 |

## 13. 风险与对策

| 风险 | 对策 |
|---|---|
| AI 诊断误判导致错误修复 | Human-in-the-Loop 审批机制；所有自动操作可回滚 |
| LLM 延迟影响故障响应速度 | 诊断采用流式输出（Streaming），边生成边展示 |
| 客户数据安全顾虑 | 支持私有化部署（On-Prem）；SaaS 版数据隔离 + SOC 2 |
| 集成适配成本高 | MVP 先对接 Top 5 工具（PagerDuty/Grafana/Prometheus/Datadog/Slack） |
| LLM Token 成本不可控 | 告警预处理（规则引擎过滤）→ 仅复杂告警走 LLM；缓存相似诊断结果 |

## 14. 后续路线图

- **P1（1-2 月）**：自动修复引擎、War Room 协作、值班管理、容量规划
- **P2（3-6 月）**：私有化部署方案、SAML/SSO、多租户 RBAC、自定义 Agent 编排
- **P3（6-12 月）**：FinOps 成本优化、移动端 App、Marketplace（社区 Runbook/Agent 插件）

---

**文档版本**：v1.0 · 2026-04-28