-- OPS Picks demo seed (3 条)
-- 1 开仓 NVDA · 1 开仓 TSM · 1 已平仓 META
-- 用 replace into 以便重复执行

set @today = curdate();
set @d_35  = date_sub(@today, interval 35 day);
set @d_21  = date_sub(@today, interval 21 day);
set @d_120 = date_sub(@today, interval 120 day);
set @d_15  = date_sub(@today, interval 15 day);

-- ————— NVDA · 开仓中 —————
replace into ops_picks (
  id, slug, ticker_symbol, ticker_name, title, subtitle,
  thesis_md, catalysts_md, risks_md, valuation_md, sell_discipline_md,
  entry_price, entry_date, target_price, stop_price, horizon_months,
  conviction, tags, status, close_price, close_date, close_reason,
  is_premium, is_published
) values (
  uuid(),
  'nvda-ai-infra-compounder-2026q2',
  'NVDA',
  '英伟达 NVIDIA',
  'NVDA · AI 基础设施的复利仓位',
  '2026 Q2 · OPS 月度首选',
  'NVIDIA 已从"GPU 厂商"进化为**全栈 AI 基础设施生态的控制者**。护城河体现在三层：\n\n1. **硬件**：Blackwell / Rubin 架构在 FP8/FP6 训练效率上领先竞争对手一整代，TSM 2nm 产能独占的谈判优势仍然稳固。\n2. **软件**：CUDA 生态 + TensorRT + NeMo 让客户迁移成本极高。即使 AMD MI 系列性能追近，软件栈生态惯性预计再延续 3-5 年。\n3. **网络**：Mellanox + NVLink 是下一代万卡集群的事实标准；HBM 供应协议锁死三星 + 美光 2026-2027 多数产能。\n\n**业绩模型**：2026 财年 Data Center 业务收入预计 $180B+（一致预期 $155B），隐含 FY27 EPS 接近 $7.2 · 对应当前股价 28x forward P/E，远低于 5 年均值的 42x。\n\n**投资论点**：在大模型训练向推理 + Agentic AI 过渡期，推理算力需求增速预计高于训练，NVDA 推理市场份额高于训练。市场仍在低估推理侧的扩张弹性。',
  '- **FY27 Q1 财报**（预计 5 月下旬）：Data Center 同比增速若保持 >80% 即验证主升浪\n- **Rubin 正式量产**（2026 Q4）：将进一步拉开与 AMD / Intel 的代际差距\n- **中国客户恢复**：H20 替代方案若获批，Q3 起新增 $8B+ 增量\n- **Agentic AI 商业化**：NIM、Agent SDK 收入占比提升，推动毛利从 74% → 78%',
  '- **估值压力**：任何 AI 资本开支放缓的信号都会触发戴维斯双杀\n- **中美博弈**：出口管制若再次收紧（针对 Blackwell 或后续架构），中国营收敞口 17%\n- **客户集中**：Top 4 超大客户合计 40%+ 营收，任何一家自研芯片节奏加快都会冲击预期\n- **技术替代风险**：定制化 ASIC（Google TPU / AWS Trainium / Meta MTIA）在特定场景已有部署，渗透速度待观察',
  '| 场景 | FY27 EPS | P/E | 目标价 |\n|------|---------|-----|--------|\n| 熊市 | $5.5  | 22x | $121 |\n| 基准 | $7.2  | 30x | **$216** |\n| 牛市 | $8.5  | 38x | $323 |\n\n当前价 ~$202，基准目标 $216 · 牛市 $323 · 下行保护 $121（-40%）。风险回报比约 1:2。',
  '- **达标减仓**：股价到达 $260 减仓 1/3，$300 减仓 1/2\n- **止损触发**：股价跌破 $175（约 -13%）无条件止损\n- **基本面破坏**：若下季度 Data Center 同比增速跌破 50%，直接平仓\n- **持仓上限**：组合权重不超过 12%（任何一天都不加仓超过上限）',
  195.80, @d_35, 216.00, 175.00, 12,
  'high', 'AI, Semi, 月度首选', 'open', null, null, null,
  1, 1
);

-- ————— TSM · 开仓中 —————
replace into ops_picks (
  id, slug, ticker_symbol, ticker_name, title, subtitle,
  thesis_md, catalysts_md, risks_md, valuation_md, sell_discipline_md,
  entry_price, entry_date, target_price, stop_price, horizon_months,
  conviction, tags, status, close_price, close_date, close_reason,
  is_premium, is_published
) values (
  uuid(),
  'tsm-2nm-inflection-2026q2',
  'TSM',
  '台积电 TSMC',
  'TSM · 2nm 节点放量的非对称机会',
  '2026 Q2 · AI 供应链核心受益方',
  '台积电 2nm 制程（N2）2026 Q4 量产，将独家承接 Apple A20 / NVIDIA Rubin / AMD MI400 等下一代旗舰芯片。\n\n**关键数据点**：\n- **2nm 订单已排到 2027 年末**，产能利用率 >100%（客户抢产能）\n- **定价权**：2nm 单片 wafer 定价 ~$25K，比 3nm 提升 35%，毛利改善显著\n- **AI 算力壁垒**：全球唯一能在 2nm 上量产 chiplet + CoWoS 先进封装的代工厂\n\n**业绩路径**：预计 2026 营收 +28%、EPS +35%，2027 进一步上扬。当前 forward P/E 24x 相对历史偏高，但 **PEG < 1**。\n\n**非对称性**：下行空间（技术落后 / 地缘冲突）清晰，但上行空间（AI 超级周期 + 市场份额集中）难以充分定价。',
  '- 2026 Q2 财报：2nm 产能爬坡进度 + CoWoS 产能扩张指引\n- Apple A20 发布（2026 秋）正式点火 2nm\n- 日本 / 德国晶圆厂项目推进，降低地缘集中度担忧',
  '- **台海风险**：地缘紧张度突发上升是最大黑天鹅，占总敞口的 tail risk\n- **客户集中**：Apple + NVIDIA 合计 40%+ 营收\n- **资本开支**：2026 capex 指引上限可能冲击 FCF 短期观感',
  '基准目标 $280（对应 FY27 EPS $9.2 · 30x P/E），较当前 ~$240 有 +16% 空间。\n\n下行保护 $195（-19%，对应 FY26 EPS 回落至 $6.5 · 30x）。',
  '- $280 减仓 1/2\n- 跌破 $205 止损\n- 若 2nm 良率信号出现问题（良率 <60%），立即重新评估',
  238.50, @d_21, 280.00, 205.00, 9,
  'high', 'AI, Semi, Foundry', 'open', null, null, null,
  1, 1
);

-- ————— META · 已平仓 —————
replace into ops_picks (
  id, slug, ticker_symbol, ticker_name, title, subtitle,
  thesis_md, catalysts_md, risks_md, valuation_md, sell_discipline_md,
  entry_price, entry_date, target_price, stop_price, horizon_months,
  conviction, tags, status, close_price, close_date, close_reason,
  is_premium, is_published
) values (
  uuid(),
  'meta-efficiency-unlock-2025q4',
  'META',
  'Meta Platforms',
  'META · 成本效率 + Reels 变现的双击',
  '2025 Q4 · 已兑现目标价',
  'Meta 2025 Q4 的投资论点核心是"AI 基建开支短期压制 + 广告 Tool 变现加速"带来的预期差。\n\n结果：Reels 广告库存变现率从 Q3 的 48% → Q4 的 63%，AI 辅助广告工具使 ROAS 提升 15%，Q4 EPS 超预期 22%。',
  '- Q4 earnings 超预期 (Realized)\n- 2026 capex 指引温和 (Realized)',
  '- Reality Labs 继续亏损（已计入估值）\n- AI 资本开支超预期（Q4 确有提升但被营收增速对冲）',
  '发布时点：$512 · 目标 $620 · 止损 $460',
  '分批减仓规则：$600 减 1/3、$620 减 1/2、$650 全平。实际于 $623 全部平仓。',
  512.00, @d_120, 620.00, 460.00, 6,
  'medium', 'Internet, AdTech', 'closed', 623.00, @d_15, '达到目标价 $620，实际成交 $623 全部平仓。',
  1, 1
);

-- 输出结果
select slug, ticker_symbol, status, is_published, entry_price, entry_date, target_price
from ops_picks order by entry_date desc;
