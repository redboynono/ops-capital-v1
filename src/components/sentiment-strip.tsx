import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import {
  buildSentimentSnapshot,
  type SentimentBias,
  type SentimentChannel,
} from "@/lib/sentiment/snapshot";

const BIAS_COLOR: Record<SentimentBias, string> = {
  bullish: "var(--success)",
  bearish: "var(--danger)",
  neutral: "var(--muted)",
};

function scoreBarWidth(score: number): string {
  const pct = Math.round(((score + 1) / 2) * 100);
  return `${Math.max(8, Math.min(92, pct))}%`;
}

function ChannelRow({
  ch,
  newsFmt,
  mentionsFmt,
}: {
  ch: SentimentChannel;
  newsFmt: (n: number) => string;
  mentionsFmt: (n: number) => string;
}) {
  const barColor =
    ch.score > 0.08 ? "bg-[color:var(--success)]" : ch.score < -0.08 ? "bg-[color:var(--danger)]" : "bg-muted";
  const mentionLabel = ch.source === "news" ? newsFmt(ch.mentions) : mentionsFmt(ch.mentions);

  return (
    <div className="grid grid-cols-[72px_1fr_52px] items-center gap-2 text-[11px]">
      <span className="truncate font-mono text-muted">{ch.label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: scoreBarWidth(ch.score) }}
        />
      </div>
      <span className="text-right font-mono text-foreground-soft">
        {ch.score >= 0 ? "+" : ""}
        {Math.round(ch.score * 100)}
      </span>
    </div>
  );
}

export async function SentimentStrip({ symbol }: { symbol: string }) {
  const locale = await getLocale();
  const s = getDictionary(locale).sentiment;
  const snap = await buildSentimentSnapshot(symbol);
  if (!snap.available) return null;

  const biasLabel = s[snap.bias];
  const biasColor = BIAS_COLOR[snap.bias];
  const scoreSign = snap.compositeScore >= 0 ? "+" : "";

  return (
    <section className="mt-3 rounded-md border border-border bg-surface-muted/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="label-caps text-[10px] text-muted">{s.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-soft">{s.subtitle}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[22px] font-bold leading-none" style={{ color: biasColor }}>
            {scoreSign}
            {snap.compositeScore}
          </p>
          <p className="mt-0.5 text-[12px] font-semibold" style={{ color: biasColor }}>
            {biasLabel}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {snap.channels.map((ch) => (
          <ChannelRow
            key={ch.source}
            ch={ch}
            newsFmt={(n) => fmt(s.newsFmt, { n })}
            mentionsFmt={(n) => fmt(s.mentionsFmt, { n })}
          />
        ))}
      </div>

      <p className="mt-2 text-[10px] text-muted-soft">
        {s.source} · {s.disclaimer}
      </p>
    </section>
  );
}
