# OPS Alpha · V1.1 功能缺口审计 + 下一步路线图

> 2026-04-21 完成全站审计。以下为 v1 上线后的遗留项。
> 绿色 = 本轮已修 · 黄色 = 待做 · 红色 = 阻塞项（需外部依赖）

---

## ✅ 本轮（v1.1）已修

| 项 | 状态 | 文件 |
|---|---|---|
| `F1-F8` 全局键盘拦截偷走浏览器 `F5` 刷新等功能 | ✅ 撤除 `FKeyListener`；保留 Function Bar 视觉标签（可点击跳转） | `src/app/(app)/layout.tsx` |
| `F8 HELP` 指向 `#` 死链 | ✅ 建 `/help` 页面，列导航 + OPS Rating 说明 + Grades 色卡 | `src/app/(app)/help/page.tsx` |
| `/news/[slug]` 没有书签按钮、不记录阅读历史（与 analysis 不对称） | ✅ 加 `BookmarkButton` + `recordRead` | `src/app/(app)/news/[slug]/page.tsx` |
| SideNav ADMIN 分组缺少「评级管理」 | ✅ 加 `/admin/ratings` 链接 | `src/components/side-nav.tsx` |
| 长文在 Terminal 黑底阅读体验差 | ✅ 加 `?reader=1` 切换米白衬线阅读模式；`reader-mode` 样式类 | `src/app/globals.css` + 两个 detail page |
| 登录页 `/terms` `/privacy` 是 `#` 死链 | ✅ 建两个正式条款页（reader-mode 呈现） | `src/app/(app)/terms/page.tsx` + `/privacy/page.tsx` |

---

## 🟡 待做 · 无外部依赖

优先级按"功能完整度 vs 实现成本"排。

### P1 · 交互与编辑闭环（本周可做）

1. **全文搜索**（Symbol / 文章标题 / 作者）
   - 顶栏加搜索框，输入 `NVDA` 直接跳 `/t/NVDA`；输入中文则全文检索 `posts.title + content`。
   - 方案：MySQL `FULLTEXT` 索引 on `posts(title, excerpt, content)` + LIKE fallback on tickers
   - UI：`<GlobalSearch />` 客户端组件，keyboard-driven，`Esc` 关闭。

2. **文章内容管理完整化**
   - Admin 内容库列表页 `/admin/posts`（按发布时间倒序 + 过滤 kind / premium / published）
   - 单篇编辑页（非仅新建）支持修改 title / body / tickers / premium / published
   - 批量操作：select + 批量取消发布
   - 当前只有 `/admin/editor` 生成 + 保存入库，之后无法回编辑。

3. **分析 / 快讯详情页目录 TOC**
   - 长文（>1500 字）右侧悬浮目录，按 `h2/h3` 生成；点击 scroll-into-view。
   - 只在 `reader-mode` 开启时显示。

4. **评级历史**
   - 当前 `ticker_factor_grades` 已有 3M / 6M 字段（手填 or AI 生成的"回溯"），但没有真实的月度快照。
   - 加一张 `ticker_rating_snapshots`（daily snapshot of ticker_ratings）使「Now/3M/6M」真成为历史。
   - 对应后台按钮：「今日收盘快照」按一次。

5. **SEO**
   - 每篇 post 生成 OG image（MiniMax + `@vercel/og` 动态卡片）
   - sitemap.xml / robots.txt

### P2 · UX 润色

6. **Dashboard profile 允许改密码**（当前只能改 fullName）
7. **通用 Toast/Flash 组件**（避免每个页面重造）
8. **分类视图 Analysis**：按行业 / 按标的筛选、按「最近一周 / 本月」切片
9. **Watchlist 直接显示 quant_score + verdict + change%**（目前只 symbol+name）
10. **OPS Quant Top 支持筛选**：板块 / 交易所 / 有无分红

### P3 · 内容管理辅助

11. **定时内容生成**：每天 06:00 cron 拉当日热点，MiniMax 生成 3 条快讯 + 1 篇分析
12. **评级周期刷新**：每周一 05:00 cron 重跑 `seed-ratings.mjs` 更新全部 ticker

---

## 🔴 阻塞项 · 需外部账号 / API Key

### A. 真实行情接入

**当前状态**：`MarketSnapshot` 指数数字 + `TickerTape` 25 个价格 全是写死 2024 demo 数据。

**方案**：[Finnhub.io](https://finnhub.io/dashboard)（免费 tier：60 req/min，覆盖美股 + 主要加密）

| 用途 | 端点 | 调用策略 |
|---|---|---|
| 实时报价 | `/quote?symbol=NVDA` | 前端 Edge function 每 10s 轮询；批量 10 symbols |
| 公司 metric | `/stock/metric?symbol=NVDA&metric=all` | 后台每日 cron 一次 |
| 分析师目标价 | `/stock/price-target?symbol=NVDA` | 后台每日 cron，写入 `ticker_ratings.street_target_price` |
| 分析师评级趋势 | `/stock/recommendation?symbol=NVDA` | 后台每周 cron，写入 `street_verdict / street_score / street_analyst_count` |
| 财报日历 | `/calendar/earnings` | 每日 cron，前端高亮未来 7 天发财报的自选股 |

**实施步骤**（约 4h）：
1. 用户注册 finnhub.io 获取免费 API key
2. 服务器 `.env.production` 加 `FINNHUB_API_KEY=xxx`
3. 新建 `src/lib/finnhub.ts`（fetch wrapper + proxy 代理）
4. 改造 `MarketSnapshot` / `TickerTape` 为 server component，从 Redis 缓存读；或写一个客户端组件用 SWR 轮询 `/api/quotes`
5. 新建 `scripts/refresh-street-ratings.mjs` + 每日 cron

**港股 A 股** Finnhub 免费层不覆盖。备选：
- 港股：富途 OpenAPI（需开户）/ 新浪财经非官方接口
- A 股：东方财富 / 新浪财经 / tushare
- 先接 Finnhub 美股 + Crypto，港股 / A 股用 static sector tag（PRD V1.2 再接）

### B. 密码重置邮件

**当前状态**：`/api/auth/forgot-password` 生成 token 后仅打印 URL 到服务器日志。

**方案**：[Resend](https://resend.com)（免费 100 封/天 · 3000 封/月）

**实施步骤**（约 30min）：
1. 用户在 resend.com 注册 → 拿 API key
2. 验证发件域名 `opscapital.com` （加 SPF / DKIM DNS 记录）
3. `.env.production` 加：
   ```
   RESEND_API_KEY=re_xxx
   RESEND_FROM_EMAIL=noreply@opscapital.com
   ```
4. `src/lib/mail.ts` 已有占位；切换到 Resend API 调用
5. 测试：/login 点「忘记密码」→ 邮箱收信 → 点链接到 `/reset-password?token=...`

### C. 订阅支付

**当前状态**：`/pricing` 页面 CTA 只跳注册；无支付流程。用户状态 `subscription_status` 永远 `inactive`。

**方案对比**：

| 渠道 | 覆盖 | 难度 | 抽成 | 适用人群 |
|---|---|---|---|---|
| **Stripe** | 全球 | 中（文档完善） | 2.9% + $0.30 | 海外用户 / 加密圈 |
| **微信支付** | 中国大陆 | 高（需企业资质 + 营业执照） | ~0.6% | 大陆用户 |
| **支付宝当面付** | 中国大陆 | 中 | ~0.6% | 大陆用户 |
| **LemonSqueezy** | 全球 + 开小号 | 低（Merchant of Record，无需公司） | 5% + $0.50 | 最快启动 |
| **Stripe + WeChat Pay via Stripe** | 全球（含大陆微信） | 中 | 2.9% + WeChat 0.8% | 中等折衷 |

**推荐路径**：
1. **阶段 1 · LemonSqueezy**（7 天上线）：无需公司，MoR 模式，自动处理税务
2. **阶段 2 · Stripe** 直接对接（拿到企业资质后）：费率更低，支持 WeChat Pay 渠道
3. **阶段 3 · 国内原生微信 / 支付宝**（目标 500 用户后）

**当前代码已有** `stripe_customer_id` 字段和 Webhook 骨架（v0 ops-capital-v1 项目留下来的，需从那边迁移过来）。

---

## 📊 数据质量审计（本次发现）

### OPS Rating 数据
- 24 个标的已通过 MiniMax 生成评级 ✅
- **但**：`rank_overall` / `rank_sector` 等名次字段是**模型编造**的（120/4200 这种数字模型自己想的，没有真实跨标的排序）
- 修复：等有 >100 个标的评级后，写个 `recompute-ranks.mjs` 真实排序

### Factor Grades 回溯
- `grade_3m` / `grade_6m` 目前是**模型凭印象写的**
- 真实回溯需要：每月末跑一次评级 → 写入 `ticker_rating_snapshots` → 详情页读「最近 3 次快照」作为 Now/3M/6M

---

## 🗺️ 推荐执行顺序

以「见到效果的速度」排序：

1. **接 Finnhub 美股行情**（4h）→ TickerTape + MarketSnapshot 立刻"活"起来
2. **接 Resend 邮件**（30min）→ 注册/忘密体验闭环
3. **全文搜索**（3h）→ 日常导航效率飙升
4. **接 LemonSqueezy 支付**（7d，含等审核）→ 开始有收入
5. **Admin posts 管理**（3h）→ 内容运营省力
6. **评级快照化**（2h）→ 数据真实性提升

总计：首周可搞定 1 + 2 + 3 + 5 + 6（约 13h 开发 + 等外部审核），第二周上支付。

---

## 📝 变更记录

- **2026-04-21 v1.1** · 首次完整审计；F-key 劫持撤销；6 个缺口修复；写下本文档
