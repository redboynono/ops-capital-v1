/**
 * 「卡点 / 价值链」叙事 franchise 的主题库。
 * ------------------------------------------------------------
 * 灵感来自 Serenity(@aleabitoreddit) 的 Chokepoint Theory，但锚定在
 * OPS Capital 自有的 AI 产业六层价值链 (L0–L5, 见 src/lib/marketing/ai-value-chain.ts)。
 *
 * 思路：不追显而易见的大票(NVDA/MSFT)，而是沿六层价值链向上游挖
 * 「整个 AI 扩张必须流经、却被市场忽视」的结构性瓶颈小/中盘股。
 *
 * 每个主题：
 *   - layer:      锚定的价值链层级(用于叙事定位)
 *   - candidates: 该卡点上被低估/少被覆盖的可交易标的(美股优先)
 *
 * 注意：candidates 不一定在 tickers 表里——卡点报告直接用 Finnhub 取 factsheet，
 * 不依赖 DB 选股。
 */

export const CHOKEPOINT_THEMES = [
  {
    id: "photonics-cpo",
    layer: "L0",
    nameZh: "光子学 / CPO 共封装光学",
    nameEn: "Photonics / Co-Packaged Optics",
    framingZh:
      "GPU 集群规模突破铜互联的物理极限后，光互联(CPO/硅光)成为 2027-2028 的结构性拐点。光源(CW 激光)、InP 衬底、光模块装配是少数单一/双寡头卡点——没有它们，超大规模 AI 组网会卡住。",
    framingEn:
      "As GPU clusters blow past copper's physical limits, optical interconnect (CPO / silicon photonics) is the 2027-2028 inflection. CW laser sources, InP substrates, and transceiver assembly are single-/duopoly chokepoints the hyperscale AI buildout must flow through.",
    candidates: [
      { symbol: "AAOI", name: "Applied Optoelectronics" },
      { symbol: "LITE", name: "Lumentum" },
      { symbol: "COHR", name: "Coherent" },
      { symbol: "POET", name: "POET Technologies" },
      { symbol: "AXTI", name: "AXT Inc (InP substrate)" },
      { symbol: "CRDO", name: "Credo Technology" },
      { symbol: "ALAB", name: "Astera Labs" },
    ],
  },
  {
    id: "power-semi",
    layer: "L2",
    nameZh: "电源半导体 / AI 机柜供电",
    nameEn: "Power semis / AI rack power delivery",
    framingZh:
      "L2 数据中心层最紧的约束已从芯片转向电力。单机柜功率从 ~10kW 飙向 100kW+，48V→芯片的高密度电源转换、GaN/SiC 器件成为新瓶颈——电送不进去，算力就是废铁。",
    framingEn:
      "At the L2 data-center layer the tightest constraint has shifted from chips to power. Rack density is rocketing from ~10kW to 100kW+, making high-density 48V-to-core conversion and GaN/SiC devices the new bottleneck — if power can't get in, the compute is dead weight.",
    candidates: [
      { symbol: "MPWR", name: "Monolithic Power Systems" },
      { symbol: "VICR", name: "Vicor" },
      { symbol: "NVTS", name: "Navitas Semiconductor (GaN)" },
      { symbol: "POWI", name: "Power Integrations" },
      { symbol: "AOSL", name: "Alpha & Omega Semiconductor" },
    ],
  },
  {
    id: "hbm-memory",
    layer: "L0",
    nameZh: "HBM / 存储瓶颈",
    nameEn: "HBM / memory bottleneck",
    framingZh:
      "L0 物理命脉层：HBM4 与专属级 DRAM 是 AI 训练/推理的全行业物理瓶颈，产能被锁定到 2026 之后。存储轮动(HBM→企业级 SSD→NAND)往往滞后于算力叙事，错配处即机会。",
    framingEn:
      "L0 physical-lifeline layer: HBM4 and specialty DRAM are an industry-wide physical bottleneck for AI, with capacity locked out past 2026. The memory rotation (HBM → enterprise SSD → NAND) tends to lag the compute narrative — the dislocation is the opportunity.",
    candidates: [
      { symbol: "MU", name: "Micron" },
      { symbol: "WDC", name: "Western Digital" },
      { symbol: "STX", name: "Seagate" },
      { symbol: "SNDK", name: "SanDisk" },
    ],
  },
  {
    id: "robotics-supply",
    layer: "L5",
    nameZh: "机器人 / 具身智能供应链",
    nameEn: "Robotics / physical-AI supply chain",
    framingZh:
      "L5 终端价值层正从纯软件 Agent 外溢到物理世界。人形机器人量产受制于谐波减速器、力矩传感器、精密执行器与边缘感知——这些上游精密件是被忽视的卡点，远比整机厂更早受益。",
    framingEn:
      "The L5 end-value layer is spilling from pure software agents into the physical world. Humanoid mass-production is gated by harmonic reducers, torque sensors, precision actuators, and edge perception — overlooked upstream precision parts that benefit far earlier than the robot OEMs.",
    candidates: [
      { symbol: "OUST", name: "Ouster (lidar/perception)" },
      { symbol: "SYM", name: "Symbotic (warehouse robotics)" },
      { symbol: "TER", name: "Teradyne (robotics + test)" },
      { symbol: "ZBRA", name: "Zebra Technologies" },
    ],
  },
  {
    id: "advanced-packaging",
    layer: "L0",
    nameZh: "先进封装 / CoWoS 与基板",
    nameEn: "Advanced packaging / CoWoS & substrates",
    framingZh:
      "L0 制造极限层：当晶体管微缩逼近物理墙，价值向先进封装(CoWoS/SoIC)迁移。封装设备、检测量测、键合与载板是 NVIDIA 产能扩张的真实瓶颈，台积电之外少有人盯。",
    framingEn:
      "L0 manufacturing-limit layer: as transistor scaling hits the wall, value migrates to advanced packaging (CoWoS/SoIC). Packaging equipment, inspection/metrology, bonding and substrates are the real bottleneck behind NVIDIA's capacity ramp — under-watched beyond TSMC.",
    candidates: [
      { symbol: "CAMT", name: "Camtek (inspection)" },
      { symbol: "KLIC", name: "Kulicke & Soffa (bonding)" },
      { symbol: "ONTO", name: "Onto Innovation (metrology)" },
      { symbol: "ACLS", name: "Axcelis (ion implant)" },
      { symbol: "COHU", name: "Cohu (test handling)" },
    ],
  },
  {
    id: "test-qualification",
    layer: "L0",
    nameZh: "测试与可靠性认证",
    nameEn: "Test & reliability qualification",
    framingZh:
      "每一颗 HBM、每一个光模块、每一颗 AI ASIC 上线前都要老化与可靠性测试。测试设备是出货量的隐形闸门——产能放量时它先满载，却常被忽略。",
    framingEn:
      "Every HBM stack, optical module, and AI ASIC must pass burn-in and reliability test before shipping. Test equipment is the invisible gate on unit volume — it saturates first in a ramp, yet is routinely overlooked.",
    candidates: [
      { symbol: "AEHR", name: "Aehr Test Systems" },
      { symbol: "FORM", name: "FormFactor (probe cards)" },
      { symbol: "COHU", name: "Cohu" },
    ],
  },
  {
    id: "thermal-cooling",
    layer: "L2",
    nameZh: "散热 / 液冷",
    nameEn: "Thermal / liquid cooling",
    framingZh:
      "L2 层：100kW+ 机柜让风冷彻底失效，直接芯片液冷(DLC)成为部署 AI 集群的硬约束。冷板、CDU、热管理供应链是超大规模厂被迫付费保供的环节。",
    framingEn:
      "L2 layer: 100kW+ racks break air cooling outright, making direct-to-chip liquid cooling (DLC) a hard constraint for deploying AI clusters. Cold plates, CDUs, and thermal-management supply are where hyperscalers are forced to pay up to keep capacity flowing.",
    candidates: [
      { symbol: "VRT", name: "Vertiv" },
      { symbol: "NVT", name: "nVent Electric" },
    ],
  },
  {
    id: "siph-compound",
    layer: "L1",
    nameZh: "硅光代工 / 化合物半导体",
    nameEn: "SiPh foundry / compound semis",
    framingZh:
      "L0→L1 衔接：硅光子代工与化合物半导体(GaAs/InP/GaN)晶圆是光子学与功率器件的上游材料卡点，专用产线稀缺、切换成本极高。",
    framingEn:
      "Bridging L0→L1: silicon-photonics foundry and compound-semi (GaAs/InP/GaN) wafers are the upstream material chokepoint for photonics and power devices, with scarce dedicated lines and high switching costs.",
    candidates: [
      { symbol: "TSEM", name: "Tower Semiconductor (SiPh foundry)" },
      { symbol: "IQE", name: "IQE plc (compound semi wafers)" },
      { symbol: "SWKS", name: "Skyworks" },
    ],
  },
];

/** 按 id 取主题 */
export function getChokepointTheme(id) {
  return CHOKEPOINT_THEMES.find((t) => t.id === id) ?? null;
}

/** 洗牌返回主题(用于每次跑不同组合) */
export function shuffledThemes() {
  return [...CHOKEPOINT_THEMES].sort(() => Math.random() - 0.5);
}
