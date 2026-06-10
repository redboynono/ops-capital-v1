# Ops Alpha · 产品需求文档 v1

> **一句话定位**：面向中文专业投资者的 AI 驱动投研+行情平台，用 Seeking Alpha 的信息架构 + 机构级视觉 + 订阅模型，做一个"每天回来"的投资者桌面。

---

## 1. 背景与动机

- **市场痛点**：中文投资者要么用雪球（UGC 噪音大、质量参差），要么付费订阅海外平台（英文门槛 + 汇率）。缺少一个 **信息密度高、决策辅助型、中文母语** 的产品。
- **供给优势**：AI 已能以接近人类编辑的质量，按模板产出机构级研报与快讯；单人运营可把"1 个编辑 vs. 500 作者 UGC 平台"的差距缩到最小。
- **商业模型**：订阅制（月付 ¥50 / 年付 ¥500，沿用 Ops Capital 已跑通的 Stripe 链路），免费看摘要+快讯、付费看完整分析+模型。

## 2. 目标用户

| 画像 | 需求 | 愿付费 |
|---|---|---|
| P0：主动管理的散户/小私募 | 每日市场概要 + 个股研报 + 自选股追踪 | ✅ |
| P1：跨境投资 AI/科技/加密 的 Founder / PM | 深度思考 + 行业结构观点 | ✅✅ |
| P2：看热闹的财经爱好者 | 短快讯 + 观点文章 | ❌（付费转化差） |

目标聚焦 **P0+P1**。

## 3. 核心产品原则

1. **Information over Entertainment**：首页不是"发现页"，是"投研桌"。信息密度第一。
2. **Ticker-centric**：任何内容必须能定位到"讲哪个标的"。Ticker 是原子。
3. **分析 vs 快讯分流**：长文分析（Analysis）和短快讯（News）两种内容类型、两种阅读路径、两种生产节奏。
4. **AI 是作者**：不把 AI 当工具藏起来，明确署名 "Ops Alpha AI" 并由人工编辑 curator 过关。
5. **付费墙轻但坚定**：摘要+快讯永远免费；完整分析+估值模型严格付费。

## 4. 信息架构

```
/                    首页（SA 式信息墙）
/analysis            分析文章列表
/analysis/[slug]     分析文章详情（付费墙）
/news                快讯时间流
/news/[slug]         快讯详情（免费全文，短）
/t/[symbol]          Ticker 详情页（聚合该标的全部分析+快讯）
/tickers             全市场 ticker 索引
/dashboard           会员桌面（概览 + 自选股 + 收藏 + 历史）
  /watchlist         自选股管理
  /library           收藏 + 阅读历史
  /profile           资料与安全
/pricing             订阅方案
/login               登录/注册
/admin               后台（仅 ADMIN_EMAILS）
  /editor            AI 研报/快讯生成器
```

左侧全局侧栏（类 SA）：
- Home / 分析 / 快讯 / Tickers / 自选股 / 会员中心 / 订阅 / 关于

## 5. 数据模型（MySQL）

```sql
users              id / email / password_hash / full_name / subscription_status / subscription_end_date / stripe_customer_id / created_at
posts              id / kind('analysis'|'news') / title / slug / excerpt / content / is_premium / is_published / author_id / created_at
tickers            symbol (PK) / name / exchange('NASDAQ'|'NYSE'|'HKEX'|'SSE'|'SZSE'|'CRYPTO') / sector / updated_at
post_tickers       post_id / symbol (PK 复合)
watchlist          user_id / symbol / created_at (PK 复合)
bookmarks          user_id / post_id / created_at (PK 复合)
reading_history    user_id / post_id / read_at (PK 复合)
```

## 6. P1 MVP 功能清单（本次交付）

### 6.1 首页 `/`
- 顶部：市场快照条（6 个指数卡：上证综指、恒生科技、纳斯达克 100、标普 500、BTC、ETH，v1 使用 seed 数据，P2 接入 API）
- 左栏：Trending Analysis（机构级长文，带时间/ticker 标签）
- 右栏：Trending News（快讯流，数字编号 1-10）
- 下部：主题分区 AI / 半导体 / 宏观 / 加密（v1 简化：只看分类 tag）

### 6.2 分析 `/analysis` + 详情
- 列表：按时间排序，可按 ticker 筛选
- 详情：摘要免费，正文付费；付费墙提供订阅 CTA
- 顶部显示关联 ticker 标签（点击跳 `/t/[symbol]`）
- 会员功能：收藏、自动阅读记录

### 6.3 快讯 `/news` + 详情
- 流式时间线，全文免费
- 每条绑 1-N 个 ticker

### 6.4 Ticker 详情 `/t/[symbol]`
- 顶部卡：代码、名称、交易所、加入自选股按钮
- Tabs：**分析**、**快讯**（本 ticker 相关）
- 相关 ticker（同 sector）

### 6.5 会员中心
- **/dashboard** 概览：订阅状态 + 自选股行情快览 + 近期阅读 + 新研报
- **/dashboard/watchlist**：增删自选股（手动输入 ticker）
- **/dashboard/library**：收藏 + 阅读历史（tabs）
- **/dashboard/profile**：改姓名、改密码

### 6.6 Admin Editor `/admin/editor`
- 输入标的/主题 + 文章类型（分析/快讯）
- AI 生成 Markdown 草稿（沿用现有 Gemini 接入）
- 编辑后保存：title / slug / excerpt / content / kind / tickers[] / is_premium / is_published

### 6.7 认证
- 邮箱+密码（沿用 Ops Capital 模式）
- 忘记密码通过 Resend 发送链接（P2）

## 7. 技术栈与复用

| 层 | 技术 | 备注 |
|---|---|---|
| 前端 | Next.js 16 + React 19 + TypeScript | App Router |
| 样式 | Tailwind CSS 4 | SA 风: 白底+小字高密度 |
| 数据库 | MySQL 8 | 复用服务器上的 ops-mysql 实例，新建 database `ops_alpha` |
| 认证 | 自研 HMAC cookie session | 沿用 ops-capital-v1 的 lib/auth.ts |
| 支付 | Stripe | P2 接入，同 ops-capital |
| AI | Gemini API via 代理 | 沿用 ops-capital-v1 的 research/generate |
| 部署 | Docker on 117.122.240.173:3200 | 共享 opscap-net 网络访问 mysql |

## 8. 视觉方向（不同于 Ops Capital 的机构暗金风）

- **色调**：白底 + 深墨文本 + **品牌橙**（类 SA 的 #E15A3C），或者**品牌红**。可选暗色模式。
- **字体**：中文思源宋体/思源黑体；英文 Inter。
- **节奏**：小字号、高信息密度、简洁卡片、清晰分割线。
- **Logo 思路**：`Ops Alpha · α` 或 `OA` 字标。

## 9. 成功指标（MVP 上线 30 天）

| 指标 | 目标 |
|---|---|
| 注册用户 | 200 |
| 付费转化率 | ≥ 3% |
| 7 日留存 | ≥ 25% |
| 日均内容产出（分析+快讯） | ≥ 3 |
| 关键 Ticker 覆盖 | ≥ 50（Top 30 美股 + Top 10 港股中概 + Top 10 加密） |

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| AI 内容同质化 | 编辑兜底 + 独家数据点（宏观数据、估值模型模板） |
| 合规（未持牌不能推荐个股） | 文末固定免责声明；避免"买入/卖出"字样 |
| 实时行情 API 成本 | v1 仅显示日频数据；实时行情放到订阅专属功能 |
| Seeking Alpha/雪球抄袭感 | 品牌差异化：AI 作者 + 机构级深度 + 中文母语 |

## 11. 后续路线图（非本次交付）

- **P2（1-2 周）**：每日简报邮件、搜索（Postgres FTS → Meilisearch）、关注作者
- **P3（1-2 月）**：评论/讨论、付费用户独立讨论组、API 开放、实时行情对接
- **P4（3-6 月）**：移动端 PWA、作者入驻计划（UGC v1）、组合追踪（虚拟账户）

---

**交付承诺**：本次 session 落地 P1 MVP 功能 6.1–6.7 的 **核心可跑版本**，部署到服务器 `3200` 端口并验证。
