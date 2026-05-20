import Link from "next/link";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";
import { buildCopilotDirectSignals, type CopilotDirectRow } from "@/lib/option-copilot-scans";

const TITLE_CLS = "text-[15px] font-bold tracking-tight text-[#0d5c6d]";

const CALL_CLS =
  "font-bold text-[#16a34a] dark:text-[#4ade80]";
const PUT_CLS =
  "font-bold text-[#dc2626] dark:text-[#f87171]";

function fmtVol(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n < 10 ? n.toFixed(2) : n.toFixed(1);
}

/** 合约列：日期+行权价用浅色，C/P 用绿/红区分 */
function ContractCell({ row }: { row: CopilotDirectRow }) {
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
        {row.contractType === "call" ? "看涨" : "看跌"}
      </span>
    </span>
  );
}

function SignalTable({
  title,
  subtitle,
  rows,
  showPct,
}: {
  title: string;
  subtitle: string;
  rows: CopilotDirectRow[];
  showPct: boolean;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <h2 className={TITLE_CLS}>{title}</h2>
        <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-muted">暂无符合条件的合约。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-[10px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-3 py-2">标的</th>
                <th className="px-3 py-2">合约</th>
                <th className="px-3 py-2 text-right">成交量</th>
                {showPct ? <th className="px-3 py-2 text-right">占全链%</th> : null}
                <th className="px-3 py-2 text-right">VWAP</th>
                <th className="px-3 py-2">信号解读</th>
                <th className="min-w-[200px] px-3 py-2">{OPTION_ALPHA.opsRecColumn}</th>
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
                    <ContractCell row={r} />
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
  compact = false,
}: {
  expirationDate: string;
  expiryLabel: string;
  symbol?: string;
  compact?: boolean;
}) {
  const rowLimit = compact ? 4 : symbol ? 8 : 10;
  const { concentration, buySide } = await buildCopilotDirectSignals({
    expirationDate,
    symbol,
    limit: rowLimit,
  });

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-soft">
        到期 <span className="font-mono text-foreground-soft">{expirationDate}</span>（{expiryLabel}
        ）· <span className={CALL_CLS}>C = 看涨 Call</span>
        <span className="mx-1 text-muted">·</span>
        <span className={PUT_CLS}>P = 看跌 Put</span>
        <span className="mx-1 text-muted">·</span>
        最右列为 OPS Alpha 推荐操作。
      </p>
      <SignalTable
        title={OPTION_ALPHA.concentrationTitle}
        subtitle="单张合约成交量占该标的同到期全链比例偏高 → 资金扎堆"
        rows={concentration}
        showPct
      />
      <SignalTable
        title={OPTION_ALPHA.buySideTitle}
        subtitle="放量且价格走强（或 Vol/OI 偏高）→ 买盘推升迹象"
        rows={buySide}
        showPct={false}
      />
      {compact ? (
        <p className="text-[12px]">
          <Link href="/expiring-options?week=this" className="font-semibold text-accent-strong hover:underline">
            打开 Option Alpha 查看全部 →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
