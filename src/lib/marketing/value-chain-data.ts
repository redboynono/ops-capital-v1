import { mysqlQuery } from "@/lib/mysql";
import {
  AI_VALUE_CHAIN_LAYERS,
  getLayerSymbols,
  type ValueChainLayer,
} from "@/lib/marketing/ai-value-chain";

export type SymbolLinkage = {
  symbol: string;
  name: string;
  ops_verdict: string | null;
  quant_score: number | null;
};

export type LayerLinkage = {
  layerId: string;
  symbols: SymbolLinkage[];
  analysisCount: number;
  newsCount: number;
  latestAnalysis: { slug: string; title: string; symbol: string } | null;
  compareSymbols: string[];
};

function buildEmptyLinkage(layer: ValueChainLayer): LayerLinkage {
  return {
    layerId: layer.id,
    symbols: getLayerSymbols(layer).map((symbol) => {
      const rep = layer.representatives.find((r) => r.symbol?.toUpperCase() === symbol);
      return { symbol, name: rep?.name ?? symbol, ops_verdict: null, quant_score: null };
    }),
    analysisCount: 0,
    newsCount: 0,
    latestAnalysis: null,
    compareSymbols: [],
  };
}

export async function getValueChainLinkage(): Promise<Record<string, LayerLinkage>> {
  const result: Record<string, LayerLinkage> = {};
  for (const layer of AI_VALUE_CHAIN_LAYERS) {
    result[layer.id] = buildEmptyLinkage(layer);
  }

  const allSymbols = [
    ...new Set(AI_VALUE_CHAIN_LAYERS.flatMap((l) => getLayerSymbols(l))),
  ];
  if (allSymbols.length === 0) return result;

  const symPlaceholders = allSymbols.map(() => "?").join(",");

  const [ratingRows, postRows] = await Promise.all([
    mysqlQuery<
      { symbol: string; name: string; ops_verdict: string | null; quant_score: string | null }[]
    >(
      `select r.symbol, t.name, r.ops_verdict, r.quant_score
         from ticker_ratings r
         inner join tickers t on t.symbol = r.symbol
        where r.symbol in (${symPlaceholders})`,
      allSymbols,
    ),
    mysqlQuery<
      { slug: string; title: string; kind: string; symbol: string; created_at: string }[]
    >(
      `select p.slug, p.title, p.kind, pt.symbol, p.created_at
         from posts p
         inner join post_tickers pt on pt.post_id = p.id
        where p.is_published = 1 and pt.symbol in (${symPlaceholders})
        order by p.created_at desc`,
      allSymbols,
    ),
  ]);

  const ratingBySymbol = new Map(
    ratingRows.map((r) => [
      r.symbol,
      {
        symbol: r.symbol,
        name: r.name,
        ops_verdict: r.ops_verdict,
        quant_score: r.quant_score != null ? Number(r.quant_score) : null,
      },
    ]),
  );

  for (const layer of AI_VALUE_CHAIN_LAYERS) {
    const symbols = getLayerSymbols(layer);
    const linkage = result[layer.id];
    linkage.symbols = symbols.map((symbol) => {
      const rep = layer.representatives.find((r) => r.symbol?.toUpperCase() === symbol);
      return ratingBySymbol.get(symbol) ?? {
        symbol,
        name: rep?.name ?? symbol,
        ops_verdict: null,
        quant_score: null,
      };
    });

    const layerPosts = postRows.filter((p) => symbols.includes(p.symbol));
    linkage.analysisCount = layerPosts.filter((p) => p.kind === "analysis").length;
    linkage.newsCount = layerPosts.filter((p) => p.kind === "news").length;

    const latest = layerPosts.find((p) => p.kind === "analysis");
    if (latest) {
      linkage.latestAnalysis = { slug: latest.slug, title: latest.title, symbol: latest.symbol };
    }

    linkage.compareSymbols = symbols
      .filter((s) => ratingBySymbol.has(s))
      .slice(0, 4);
    if (linkage.compareSymbols.length === 0) {
      linkage.compareSymbols = symbols.slice(0, 4);
    }
  }

  return result;
}
