import { listAllTickers } from "@/lib/tickers";
import { TickersBrowser } from "@/components/tickers-browser";
import { getDictionary, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function TickersIndexPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).tickersPage;
  const tickers = await listAllTickers();

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{t.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{t.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{t.subtitle}</p>
      </header>

      <TickersBrowser tickers={tickers} exchangeLabels={t.exchanges} />
    </div>
  );
}
