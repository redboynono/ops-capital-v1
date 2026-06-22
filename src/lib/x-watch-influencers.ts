export type XWatchInfluencerCategory = "ai" | "finance" | "semiconductor";

export type XWatchInfluencer = {
  handle: string;
  label: string;
};

/**
 * Curated high-signal X accounts (English-first where possible).
 * Sources: HTX/PANews 2026 de-noised finance list, SemiAnalysis ecosystem, FinTwit.
 * Override entirely with env X_WATCH_USERNAMES if needed.
 */
export const X_WATCH_INFLUENCER_REGISTRY: Record<XWatchInfluencerCategory, XWatchInfluencer[]> = {
  ai: [
    { handle: "aleabitoreddit", label: "Serenity · Neocloud / AI infra" },
    { handle: "karpathy", label: "Andrej Karpathy · AI research" },
    { handle: "ylecun", label: "Yann LeCun · AI research" },
    { handle: "AravSrinivas", label: "Perplexity CEO" },
    { handle: "medriscoll", label: "DCVC · AI / data infra" },
    { handle: "bindureddy", label: "Abacus AI · agents" },
    { handle: "drjimfan", label: "NVIDIA · AI" },
    { handle: "svpino", label: "AI engineering" },
    { handle: "GaryMarcus", label: "AI critique / research" },
    { handle: "goodfellow_ian", label: "Deep learning" },
    { handle: "hardmaru", label: "ML research" },
    { handle: "AndrewYNg", label: "AI education / industry" },
    { handle: "drfeifei", label: "Stanford HAI" },
    { handle: "OpenAI", label: "OpenAI official" },
    { handle: "AnthropicAI", label: "Anthropic official" },
    { handle: "nvidia", label: "NVIDIA official" },
    { handle: "satnam6502", label: "Google · ML systems" },
    { handle: "chrisalbon", label: "ML / data science" },
    { handle: "emollick", label: "Wharton · AI usage" },
    { handle: "rowancheung", label: "AI news / products" },
  ],
  finance: [
    { handle: "GavinSBaker", label: "Atreides · tech L/S" },
    { handle: "SuperMugatu", label: "Dan McMurtrie · tech macro" },
    { handle: "John_Hempton", label: "Bronte · value / macro" },
    { handle: "convertbond", label: "Lawrence McDonald · macro" },
    { handle: "dariusdale42", label: "42 Macro · cycles" },
    { handle: "kobeissiletter", label: "Kobeissi Letter · macro data" },
    { handle: "charliebilello", label: "Charts / macro" },
    { handle: "ReformedBroker", label: "Josh Brown · markets" },
    { handle: "unusual_whales", label: "Options flow" },
    { handle: "Hipsterinvestor", label: "Macro / markets" },
    { handle: "macroalf", label: "Alf · macro" },
    { handle: "modestproposal1", label: "Bill Sweet · macro" },
    { handle: "lizannsonders", label: "Liz Ann Sonders · strategist" },
    { handle: "jasonzweigwsj", label: "WSJ · investing" },
    { handle: "michaeljburry", label: "Scion · deep value" },
    { handle: "AndurandPierre", label: "Andurand · commodities/macro" },
    { handle: "ramahluwalia", label: "Lumida · tech + macro" },
    { handle: "gerberkawasaki", label: "Gerber Kawasaki · growth" },
    { handle: "matthew_sigel", label: "VanEck · crypto/tech macro" },
    { handle: "jimcramer", label: "CNBC · market narrative" },
  ],
  semiconductor: [
    { handle: "dylan522p", label: "SemiAnalysis · AI semi capex" },
    { handle: "tengyanai", label: "Delphi · semi / AI chain" },
    { handle: "SemiAnalysis", label: "SemiAnalysis firm" },
    { handle: "crux_capital_", label: "Gaetano · optical semi" },
    { handle: "firstadopter", label: "Tae Kim · semi fundamentals" },
    { handle: "stacyrasgon", label: "Bernstein · semi analyst" },
    { handle: "Pierre_Ferragu", label: "New Street · semi" },
    { handle: "TimothyARCU", label: "Semi supply chain" },
    { handle: "lordwilliamuk", label: "Semi / AI hardware" },
    { handle: "rickawsb", label: "AWS / cloud semi angle" },
    { handle: "ASMLcompany", label: "ASML official" },
    { handle: "AMD", label: "AMD official" },
    { handle: "Intel", label: "Intel official" },
    { handle: "MicronTechnology", label: "Micron official" },
    { handle: "SkyWaterFoundry", label: "US foundry" },
    { handle: "MarvellTech", label: "Marvell · networking semi" },
    { handle: "Broadcom", label: "Broadcom · custom silicon" },
    { handle: "Arm", label: "Arm · IP" },
    { handle: "TSMC", label: "TSMC official" },
    { handle: "wolf_financial", label: "WOLF · semi / tech narrative" },
  ],
};

export const X_WATCH_CATEGORY_LABEL: Record<XWatchInfluencerCategory, string> = {
  ai: "AI",
  finance: "金融",
  semiconductor: "半导体",
};

export function parseWatchCategories(raw?: string | null): XWatchInfluencerCategory[] {
  const all: XWatchInfluencerCategory[] = ["ai", "finance", "semiconductor"];
  if (!raw?.trim()) return all;
  const picked = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = picked.filter((c): c is XWatchInfluencerCategory =>
    all.includes(c as XWatchInfluencerCategory),
  );
  return out.length > 0 ? out : all;
}

export function watchTopN(): number {
  const n = Number(process.env.X_WATCH_TOP_N ?? 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(50, Math.round(n)));
}

/** Accounts fetched from X per cron tick (registry mode: round-robin across categories). */
export function watchPollBatchSize(): number {
  const n = Number(process.env.X_WATCH_POLL_BATCH ?? 3);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(30, Math.round(n)));
}

/** Pending tweets analyzed (+ optional auto Quote) per cron tick. */
export function watchAnalyzeBatchSize(): number {
  const n = Number(process.env.X_WATCH_ANALYZE_BATCH ?? 5);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(20, Math.round(n)));
}

export function resolveWatchInfluencers(): {
  handles: string[];
  byCategory: Partial<Record<XWatchInfluencerCategory, string[]>>;
  categories: XWatchInfluencerCategory[];
  topN: number;
} {
  const categories = parseWatchCategories(process.env.X_WATCH_CATEGORIES);
  const topN = watchTopN();
  const byCategory: Partial<Record<XWatchInfluencerCategory, string[]>> = {};
  const seen = new Set<string>();
  const handles: string[] = [];

  for (const cat of categories) {
    const list = X_WATCH_INFLUENCER_REGISTRY[cat].slice(0, topN).map((i) => i.handle.replace(/^@/, ""));
    byCategory[cat] = list;
    for (const h of list) {
      const key = h.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      handles.push(h);
    }
  }

  return { handles, byCategory, categories, topN };
}
