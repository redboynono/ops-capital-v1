# OPS Crypto 因子模型设计（Phase B 设计稿）

> 目标：为加密资产（BTC/ETH/SOL…）设计一套**原生因子评分模型**，
> 复用现有 `ticker_ratings` / `ticker_factor_grades` / `quant_score` 管线，
> 与股票五因子**共存**而不互相污染。本文件是 Phase A（CoinGecko 原型）的实现蓝图。

---

## 1. 设计原则

1. **复用评分管线**：沿用 GPA（A+~F → 0~4.3）→ `quant_score`（1.00~5.00）这套机制，
   前端 verdict 徽章 / Quant 分数 / Factor Grades 面板**零改造**即可展示币种。
2. **按资产类别分流**：股票看股票五因子，加密看加密因子。靠 `asset_class` 区分，
   而不是把两套因子塞进同一权重表。
3. **因子语义对标股票**：每个加密因子尽量映射到一个股票因子的"心智位置"，
   让懂股票的用户秒懂（估值/成长/质量/动量）。
4. **Phase 1 数据可得性优先**：第一版所有因子必须能**仅凭 CoinGecko 免费接口**算出，
   高级链上指标（MVRV / NVT / 活跃地址）留作 Phase 2 增量。

---

## 2. 加密原生六因子

| Key (enum)         | 中文名      | 对标股票因子        | 权重  | 含义 |
|--------------------|-------------|---------------------|------|------|
| `CRYPTO_VALUATION` | 估值        | Valuation           | 0.20 | 相对自身/同类是否便宜 |
| `NETWORK`          | 网络与采用  | Growth+Profitability| 0.25 | 链上使用、开发者、生态需求 |
| `TOKENOMICS`       | 代币经济    | （加密特有）        | 0.15 | 通胀/解锁/集中度/质押 |
| `MOMENTUM`         | 动量        | Momentum（复用）    | 0.20 | 价格趋势与相对强弱 |
| `LIQUIDITY`        | 流动性      | （加密特有）        | 0.10 | 成交量/深度/上所广度 |
| `SECURITY`         | 安全与去中心化 | Quality 质押        | 0.10 | 抗攻击、存续时间、审计 |

权重合计 = 1.00。`MOMENTUM` 与股票模型同名复用（同一 enum 值），其余为新增。

### 2.1 因子打分定义（A=最优 / F=最差）

#### `CRYPTO_VALUATION` 估值（0.20）
- **指标**：`mcap/FDV`（流通占比，越接近 1 越无解锁稀释）、`volume/mcap`（换手）、
  距 ATH 回撤幅度、市值分位（同类内 percentile）。
- Phase 2 增量：MVRV-Z、NVT signal、Market Cap / TVL（DeFi）、P/F（price-to-fees）。
- **评级**：A = 深度低估（回撤深、换手健康、FDV 稀释小）；F = 接近 ATH 且 FDV 远高于流通市值。

#### `NETWORK` 网络与采用（0.25）
- **指标（Phase 1，CoinGecko `developer_data` + `community_data` + 成交趋势）**：
  GitHub commits / stars / 活跃贡献者、社区规模、成交量 30d 趋势。
- Phase 2 增量：活跃地址 30d 趋势、交易笔数/费用、TVL 趋势、稳定币供应。
- **评级**：A = 开发与使用同步扩张；F = 开发停滞、链上活动萎缩。

#### `TOKENOMICS` 代币经济（0.15）
- **指标**：净通胀/增发率（由 `circulating/total/max_supply` 推断）、
  流通占比 `circulating/max`、未来 90d 解锁占流通比（解锁悬顶）、
  Top-holder 集中度（Phase 2）、质押率/销毁（Phase 2）。
- **评级**：A = 通缩或低增发、解锁压力小、质押率高；F = 高增发 + 大额解锁 + 高度集中。

#### `MOMENTUM` 动量（0.20，复用股票 enum）
- **指标**：30/90/180d 收益、相对 BTC 强弱（RS）、距 200D 均线、波动率调整后动量。
- **评级**：A = 多周期正动量且跑赢 BTC；F = 跌破长期均线、持续跑输。

#### `LIQUIDITY` 流动性（0.10）
- **指标**：30d 平均现货成交量、上所/交易对数量（CoinGecko `tickers`）、
  ETF/合规渠道可得性。Phase 2：盘口 ±2% 深度、衍生品 OI、OI/mcap、买卖价差。
- **评级**：A = 大盘深、上所广、有 ETF；F = 单一交易所、薄盘、易操纵。

#### `SECURITY` 安全与去中心化（0.10）
- **指标**：主网存续时间（`genesis_date`）、验证者/节点数与 Nakamoto 系数（Phase 2）、
  审计覆盖、历史被黑/漏洞记录、治理透明度、类别风险（meme/新链更高风险）。
- **评级**：A = 久经考验、去中心化高、无重大事故；F = 新链/中心化/有被黑史。

---

## 3. 与现有 schema 的共存方案

### 3.1 `tickers`：新增 `asset_class`
```sql
alter table tickers
  add column asset_class enum('equity','crypto','etf')
  not null default 'equity' after exchange;

update tickers set asset_class = 'crypto' where exchange = 'CRYPTO';
```
- 作为评分分流、排行榜过滤、AI prompt 选择的唯一开关。
- 不依赖 `exchange='CRYPTO'` 隐式判断，便于以后 ETF / 商品扩展。

### 3.2 `ticker_factor_grades.factor`：扩展 enum（向后兼容）
```sql
alter table ticker_factor_grades
  modify factor enum(
    'VALUATION','GROWTH','PROFITABILITY','MOMENTUM','REVISIONS',
    'DIV_SAFETY','DIV_GROWTH','DIV_YIELD','DIV_CONSISTENCY',
    'CRYPTO_VALUATION','NETWORK','TOKENOMICS','LIQUIDITY','SECURITY'
  ) not null;
```
- 表结构（`grade_now/3m/6m`、PK `(symbol,factor)`）完全复用，零迁移数据。
- `MOMENTUM` 跨资产类别共用同一 enum 值。

### 3.3 `ticker_ratings`：复用为主 + 少量语义重映射
保持不变直接复用：
- `ops_verdict / ops_score`：OPS Desk 观点（强烈买入~强烈卖出）。
- `quant_score`：加密六因子加权结果，沿用现有列。
- `rank_overall / rank_sector`：在**加密 universe 内**排名（sector 复用为类别）。
- `industry`：复用为**加密类别**（`Layer 1` / `DeFi` / `Stablecoin` / `Meme` / `Infra`）。
- `notes / source`：照常。

可选新增（Phase 2，避免污染，全部 nullable）：
```sql
alter table ticker_ratings
  add column staking_yield decimal(5,2) null,   -- 质押年化%
  add column circulating_pct decimal(5,2) null; -- 流通/最大供应%
```
- `street_*`：股票里是"卖方分析师一致预期"。加密无对应物 →
  Phase 1 **前端对 crypto 隐藏 Street 行**（不删列，仅条件渲染）；
  Phase 2 可重映射为"社区/聚合评级"。
- `has_dividend`：crypto 永远 0，前端用 `asset_class` 决定是否显示分红子因子，
  分红四因子（`DIV_*`）对 crypto 不打分。

---

## 4. 评分管线改造点（Phase A 落地清单）

`src/lib/ratings.ts`
- 新增 `CRYPTO_FACTORS = ['CRYPTO_VALUATION','NETWORK','TOKENOMICS','MOMENTUM','LIQUIDITY','SECURITY']`。
- `FACTOR_LABELS` 补充五个新 key 的中英文。
- `computeQuantScore(grades, assetClass)` 改为按 `assetClass` 选权重表：
  ```ts
  const CRYPTO_WEIGHTS = {
    CRYPTO_VALUATION: 0.20, NETWORK: 0.25, TOKENOMICS: 0.15,
    MOMENTUM: 0.20, LIQUIDITY: 0.10, SECURITY: 0.10,
  };
  ```
- `recomputeAndStoreQuantScore(symbol)` 先查 `tickers.asset_class` 再选因子集。

`src/lib/ai/generateRating.ts`
- 按 `asset_class==='crypto'` 切换 system/user prompt 与 factsheet 字段（喂 CoinGecko 数据而非股票财报）。

前端（`rating-panels.tsx` / `rating-editor.tsx` / `compare/page.tsx` / `top-rated.tsx`）
- 因子表头与行按 `asset_class` 渲染对应因子集。
- crypto 隐藏 Street 行与分红子因子。

---

## 5. Phase A 数据源映射（CoinGecko 免费版）

单接口 `GET /coins/{id}?localization=false&tickers=true&market_data=true&developer_data=true&community_data=true`
即可覆盖第一版全部六因子：

| 因子 | CoinGecko 字段 |
|------|----------------|
| `CRYPTO_VALUATION` | `market_data.market_cap`, `fully_diluted_valuation`, `ath_change_percentage`, `total_volume` |
| `NETWORK` | `developer_data.commit_count_4_weeks/stars/pull_requests_merged`, `community_data`, 成交量趋势 |
| `TOKENOMICS` | `market_data.circulating_supply / total_supply / max_supply` |
| `MOMENTUM` | `price_change_percentage_30d/200d/1y_in_currency` |
| `LIQUIDITY` | `total_volume`, `tickers[]`（上所/交易对数）|
| `SECURITY` | `genesis_date`, `categories`, 存续时长 |

> 符号映射：库内短码 `BTC` → CoinGecko id `bitcoin`（需维护 `symbol → coingecko_id` 映射表，
> 建议 Phase A 加 `tickers.coingecko_id varchar(64) null`）。

---

## 6. Phase A 交付物（待动手）

1. 迁移 `017_crypto_factors.sql`：`asset_class` + factor enum 扩展 + `coingecko_id`。
2. `src/lib/coingecko.ts`：拉取 + 归一化为 factsheet。
3. `src/lib/crypto/scoreFactors.ts`：六因子 → GPA → quant_score 的确定性打分（无需 AI 也能跑）。
4. 加密因子评分页（复用 `compare` / `t/[symbol]` 视图，按 asset_class 渲染）。
5. 一篇跨市场分析文章（BTC/ETH 用新模型 vs 一只科技股）。
