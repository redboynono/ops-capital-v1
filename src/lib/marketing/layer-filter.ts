import { getLayerById, getLayerSymbols } from "@/lib/marketing/ai-value-chain";

export function resolveLayerFilter(layerParam?: string) {
  const layer = layerParam ? getLayerById(layerParam) : null;
  if (!layer) return { layer: null, symbols: undefined as string[] | undefined };
  return { layer, symbols: getLayerSymbols(layer) };
}
