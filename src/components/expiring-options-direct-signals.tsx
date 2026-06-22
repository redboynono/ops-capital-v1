import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import { buildCopilotDirectSignals, type CopilotDirectRow } from "@/lib/option-copilot-scans";

const TITLE_CLS = "text-[15px] font-bold tracking-tight text-[#0d5c6d]";

const CALL_CLS = "font-bold text-[#16a34a] dark:text-[#4ade80]";
const PUT_CLS = "font-bold text-[#dc2626] dark:text-[#f87171]";

function fmtVol(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n < 10 ? n.toFixed(2) : n.toFixed(1);
}

function ContractCell({
  row,
  callTag,
  putTag,
}: {
  row: CopilotDirectRow;
  callTag: string;
  putTag: string;
}) {
  const typeSuffix = row.contractType === "call" ? " C" : " P";
  const base = row.optionLabel.endsWith(typeSuffix)
    ? row.optionLabel.slice(0, -typeSuffix.length)
    : row.optionLabel;

  return (
    <span className="font-mono text-[11px]">
      <span className="text-foreground-soft">{base}</span>
      <span className={row.contractType === "call" ? ` ${CALL_CLS}` : ` ${PUT_CLS}`}>
        {row.contractType === "call" ? "C" : "P"}
      </span>
      <span
        className={`ml-1.5 inline-block rounded px-1 py-px text-[9px] font-semibold uppercase ${
          row.contractType === "call"
            ? "bg-[color:color-mix(in_srgb,#16a34a_18%,transparent)] text-[#15803d] dark:text-[#86efac]"
            : "bg-[color:color-mix(in_srgb,#dc2626_18%,transparent)] text-[#b91c1c] dark:text-[#fca5a5]"
        }`}
      >
        {row.contractType === "call" ? callTag : putTag}
      </span>
    </span>
  );
}

function SignalTable({
  title,
  subtitle,
  rows,
  showPct,
  o,
}: {
  title: string;
  subtitle: string;
  rows: CopilotDirectRow[];
  showPct: boolean;
  o: ReturnType<typeof getDictionary>["options"];
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <h2 className={TITLE_CLS}>{title}</h2>
        <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-muted">{o.noContracts}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-[10px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">{o.tableUnderlying}</th>
                <th className="px-3 py-2">{o.tableContract}</th>
                <th className="px-3 py-2 text-right">{o.tableVolume}</th>
                {showPct ? <th className="px-3 py-2 text-right">{o.tablePctChain}</th> : null}
                <th className="px-3 py-2 text-right">{o.tableVwap}</th>
                <th className="px-3 py-2">{o.tableSignal}</th>
                <th className="min-w-[200px] px-3 py-2">{o.opsRecColumn}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.underlying}-${r.optionLabel}`}
                  className={`border-b border-border/60 ${
                    r.contractType === "call"
                      ? "bg-[color:color-mix(in_srgb,#16a34a_4%,transparent)]"
                      : "bg-[color:color-mix(in_srgb,#dc2626_4%,transparent)]"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/t/${r.underlying}`}
                      className="font-mono font-bold text-accent-strong hover:underline"
                    >
                      {r.underlying}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <ContractCell row={r} callTag={o.callTag} putTag={o.putTag} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-foreground">{fmtVol(r.volume)}</td>
                  {showPct ? (
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">
                      {r.pctOfTotal != null ? `${r.pctOfTotal.toFixed(1)}%` : "—"}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 text-right font-mono text-foreground">{fmtPrice(r.vwap)}</td>
                  <td className="px-3 py-2.5 text-[12px] leading-snug text-muted">{r.actionHint}</td>
                  <td className="px-3 py-2.5">
                    <p
                      className={`text-[12px] font-semibold leading-snug ${
                        r.contractType === "call"
                          ? "text-[#15803d] dark:text-[#86efac]"
                          : "text-[#b91c1c] dark:text-[#fca5a5]"
                      }`}
                    >
                      <span className="text-accent-strong">OPS Alpha · </span>
                      {r.opsAlphaRec}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export async function ExpiringOptionsDirectSignals({
  expirationDate,
  expiryLabel,
  symbol,
  underlyings,
  compact = false,
  rowLimit: rowLimitProp,
}: {
  expirationDate: string;
  expiryLabel: string;
  symbol?: string;
  underlyings?: readonly string[];
  compact?: boolean;
  rowLimit?: number;
}) {
  const locale = await getLocale();
  const o = getDictionary(locale).options;
  const rowLimit = rowLimitProp ?? (compact ? 4 : symbol ? 8 : 10);
  const { concentration, buySide } = await buildCopilotDirectSignals({
    expirationDate,
    symbol,
    underlyings,
    limit: rowLimit,
    copy: o.copilot,
  });

  const expiryLine = fmt(o.expiryLineFmt, {
    date: expirationDate,
    label: expiryLabel,
    callNote: o.callNote,
    putNote: o.putNote,
    opsNote: o.opsNote,
  });

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-soft">{expiryLine}</p>
      <SignalTable
        title={o.concentrationTitle}
        subtitle={o.concentrationSub}
        rows={concentration}
        showPct
        o={o}
      />
      <SignalTable title={o.buySideTitle} subtitle={o.buySideSub} rows={buySide} showPct={false} o={o} />
      {compact ? (
        <p className="text-[12px]">
          <Link href="/expiring-options?week=this" className="font-semibold text-accent-strong hover:underline">
            {o.openFull}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
