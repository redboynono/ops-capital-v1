import { listScreenerRows } from "@/lib/screener";
import { ScreenerBrowser } from "@/components/screener-browser";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "选股器 · OPS Alpha",
  description: "用 OPS Quant 评级 + 五因子（估值 / 成长 / 盈利 / 动能 / 上调）筛选标的。",
};

export default async function ScreenerPage() {
  const rows = await listScreenerRows();

  const ratedCount = rows.filter((r) => r.quant_score != null).length;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Screener</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">选股器</h1>
        <p className="mt-1 text-[13px] text-muted">
          全市场标的 · OPS Quant 评级 + 五因子 · 单选 / 多选条件实时筛选
          {ratedCount > 0 ? (
            <>
              {" "}
              · 当前 <span className="mono font-bold text-foreground-soft">{ratedCount}</span> 只已评级
            </>
          ) : null}
        </p>
      </header>

      <ScreenerBrowser rows={rows} />
    </div>
  );
}
