#!/usr/bin/env node
// 种 3 条 demo OPS Picks（1 开仓 NVDA · 1 开仓 TSM · 1 已平仓 META）
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

const url = process.env.MYSQL_URL;
if (!url) {
  console.error("MYSQL_URL env not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const picks = [
  {
    slug: "nvda-ai-infra-compounder-2026q2",
    ticker_symbol: "NVDA",
    ticker_name: "英伟达 NVIDIA",
    title: "NVDA · AI 基础设施的复利仓位",
    subtitle: "2026 Q2 · OPS 月度首选",
    thesis_md: `NVIDIA 已从"GPU 厂商"进化为**全栈 AI 基础设施生态的控制者**。护城河体现在三层：

1. **硬件**：Blackwell / Rubin 架构在 FP8/FP6 训练效率上领先竞争对手一整代，TSM 2nm 产能独占的谈判优势仍然稳固。
2. **软件**：CUDA 生态 + TensorRT + NeMo 让客户迁移成本极高。即使 AMD MI 系列性能追近，软件栈生态惯性预计再延续 3-5 年。
3. **网络**：Mellanox + NVLink 是下一代万卡集群的事实标准；HBM 供应协议锁死三星 + 美光 2026-2027 多数产能。

**业绩模型**：2026 财年 Data Center 业务收入预计 $180B+（一致预期 $155B），隐含 FY27 EPS 接近 $7.2 · 对应当前股价 28x forward P/E，远低于 5 年均值的 42x。

**投资论点**：在大模型训练向推理 + Agentic AI 过渡期，推理算力需求增速预计高于训练，NVDA 推理市场份额高于训练（Hopper / Blackwell 在推理上的能效优势更大）。市场仍在低估推理侧的扩张弹性。`,
    catalysts_md: `- **FY27 Q1 财报**（预计 5 月下旬）：Data Center 同比增速若保持 >80% 即验证主升浪
- **Rubin 正式量产**（2026 Q4）：将进一步拉开与 AMD / Intel 的代际差距
- **中国客户恢复**：H20 替代方案若获批，Q3 起新增 $8B+ 增量
- **Agentic AI 商业化**：NIM、Agent SDK 收入占比提升，推动毛利从 74% → 78%`,
    risks_md: `- **估值压力**：任何 AI 资本开支放缓的信号都会触发戴维斯双杀
- **中美博弈**：出口管制若再次收紧（针对 Blackwell 或后续架构），中国营收敞口 17%
- **客户集中**：Top 4 超大客户合计 40%+ 营收，任何一家自研芯片节奏加快都会冲击预期
- **技术替代风险**：定制化 ASIC（Google TPU / AWS Trainium / Meta MTIA）在特定场景已有部署，渗透速度待观察`,
    valuation_md: `| 场景 | FY27 EPS | P/E | 目标价 |
|------|---------|-----|--------|
| 熊市 | $5.5  | 22x | $121 |
| 基准 | $7.2  | 30x | **$216** |
| 牛市 | $8.5  | 38x | $323 |

当前价 ~$202，基准目标 $216 · 牛市 $323 · 下行保护 $121（-40%）。风险回报比约 1:2。`,
    sell_discipline_md: `- **达标减仓**：股价到达 $260 减仓 1/3，$300 减仓 1/2
- **止损触发**：股价跌破 $175（约 -13%）无条件止损
- **基本面破坏**：若下季度 Data Center 同比增速跌破 50%，直接平仓
- **持仓上限**：组合权重不超过 12%（任何一天都不加仓超过上限）`,
    entry_price: 195.8,
    entry_date: daysAgo(35),
    target_price: 216,
    stop_price: 175,
    horizon_months: 12,
    conviction: "high",
    tags: "AI, Semi, 月度首选",
    status: "open",
    is_premium: 1,
    is_published: 1,
  },
  {
    slug: "tsm-2nm-inflection-2026q2",
    ticker_symbol: "TSM",
    ticker_name: "台积电 TSMC",
    title: "TSM · 2nm 节点放量的非对称机会",
    subtitle: "2026 Q2 · AI 供应链核心受益方",
    thesis_md: `台积电 2nm 制程（N2）2026 Q4 量产，将独家承接 Apple A20 / NVIDIA Rubin / AMD MI400 等下一代旗舰芯片。

**关键数据点**：
- **2nm 订单已排到 2027 年末**，产能利用率 >100%（客户抢产能）
- **定价权**：2nm 单片 wafer 定价 ~$25K，比 3nm 提升 35%，毛利改善显著
- **AI 算力壁垒**：全球唯一能在 2nm 上量产 chiplet + CoWoS 先进封装的代工厂

**业绩路径**：预计 2026 营收 +28%、EPS +35%，2027 进一步上扬。当前 forward P/E 24x 相对历史偏高，但 **PEG < 1**。

**非对称性**：下行空间（技术落后 / 地缘冲突）清晰，但上行空间（AI 超级周期 + 市场份额集中）难以充分定价。`,
    catalysts_md: `- 2026 Q2 财报：2nm 产能爬坡进度 + CoWoS 产能扩张指引
- Apple A20 发布（2026 秋）正式点火 2nm
- 日本 / 德国晶圆厂项目推进，降低地缘集中度担忧`,
    risks_md: `- **台海风险**：地缘紧张度突发上升是最大黑天鹅，占总敞口的 tail risk
- **客户集中**：Apple + NVIDIA 合计 40%+ 营收
- **资本开支**：2026 capex 指引上限可能冲击 FCF 短期观感`,
    valuation_md: `基准目标 $280（对应 FY27 EPS $9.2 · 30x P/E），较当前 ~$240 有 +16% 空间。

下行保护 $195（-19%，对应 FY26 EPS 回落至 $6.5 · 30x）。`,
    sell_discipline_md: `- $280 减仓 1/2
- 跌破 $205 止损
- 若 2nm 良率信号出现问题（良率 <60%），立即重新评估`,
    entry_price: 238.5,
    entry_date: daysAgo(21),
    target_price: 280,
    stop_price: 205,
    horizon_months: 9,
    conviction: "high",
    tags: "AI, Semi, Foundry",
    status: "open",
    is_premium: 1,
    is_published: 1,
  },
  {
    slug: "meta-efficiency-unlock-2025q4",
    ticker_symbol: "META",
    ticker_name: "Meta Platforms",
    title: "META · 成本效率 + Reels 变现的双击",
    subtitle: "2025 Q4 · 已兑现目标价",
    thesis_md: `Meta 2025 Q4 的投资论点核心是"AI 基建开支短期压制 + 广告 Tool 变现加速"带来的预期差。

结果：Reels 广告库存变现率从 Q3 的 48% → Q4 的 63%，AI 辅助广告工具使 ROAS 提升 15%，Q4 EPS 超预期 22%。`,
    catalysts_md: `- Q4 earnings 超预期 (Realized)
- 2026 capex 指引温和 (Realized)`,
    risks_md: `- Reality Labs 继续亏损（已计入估值）
- AI 资本开支超预期（Q4 确有提升但被营收增速对冲）`,
    valuation_md: `发布时点：$512 · 目标 $620 · 止损 $460`,
    sell_discipline_md: `分批减仓规则：$600 减 1/3、$620 减 1/2、$650 全平。实际于 $623 全部平仓。`,
    entry_price: 512,
    entry_date: daysAgo(120),
    target_price: 620,
    stop_price: 460,
    horizon_months: 6,
    conviction: "medium",
    tags: "Internet, AdTech",
    status: "closed",
    close_price: 623,
    close_date: daysAgo(15),
    close_reason: "达到目标价 $620，实际成交 $623 全部平仓。",
    is_premium: 1,
    is_published: 1,
  },
];

for (const p of picks) {
  const [existing] = await conn.execute(
    "select id from ops_picks where slug = ? limit 1",
    [p.slug],
  );
  const id = existing[0]?.id ?? randomUUID();
  const values = [
    id, p.slug, p.ticker_symbol, p.ticker_name, p.title, p.subtitle,
    p.thesis_md, p.catalysts_md ?? null, p.risks_md ?? null, p.valuation_md ?? null, p.sell_discipline_md ?? null,
    p.entry_price, p.entry_date, p.target_price, p.stop_price, p.horizon_months,
    p.conviction, p.tags ?? null, p.status,
    p.close_price ?? null, p.close_date ?? null, p.close_reason ?? null,
    p.is_premium, p.is_published,
  ];

  if (existing[0]) {
    await conn.execute(
      `update ops_picks set
        ticker_symbol=?, ticker_name=?, title=?, subtitle=?,
        thesis_md=?, catalysts_md=?, risks_md=?, valuation_md=?, sell_discipline_md=?,
        entry_price=?, entry_date=?, target_price=?, stop_price=?, horizon_months=?,
        conviction=?, tags=?, status=?, close_price=?, close_date=?, close_reason=?,
        is_premium=?, is_published=?
       where id=?`,
      [...values.slice(2), id],
    );
    console.log(`updated: ${p.slug}`);
  } else {
    await conn.execute(
      `insert into ops_picks (
        id, slug, ticker_symbol, ticker_name, title, subtitle,
        thesis_md, catalysts_md, risks_md, valuation_md, sell_discipline_md,
        entry_price, entry_date, target_price, stop_price, horizon_months,
        conviction, tags, status, close_price, close_date, close_reason,
        is_premium, is_published
      ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      values,
    );
    console.log(`inserted: ${p.slug}`);
  }
}

await conn.end();
console.log("done.");
