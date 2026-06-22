import { NextResponse } from "next/server";
import { buildSymbolExpiringOptionsPlaybook } from "@/lib/expiring-options-playbook";
import { getDictionary, getLocale } from "@/lib/i18n";
import { expiryWeekLabel, resolveExpirySelection } from "@/lib/options-expiry";

export const dynamic = "force-dynamic";

/** GET /api/options/expiring/playbook?symbol=NVDA&week=next */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const expiry = resolveExpirySelection({
    week: url.searchParams.get("week") ?? undefined,
    exp: url.searchParams.get("exp") ?? undefined,
  });
  const locale = await getLocale();
  const o = getDictionary(locale).optionsPage;
  const expiryLabel = expiryWeekLabel(
    expiry.expirationDate,
    expiry.thisFriday,
    expiry.nextFriday,
    o.expiry,
  );
  const result = await buildSymbolExpiringOptionsPlaybook(
    symbol,
    o.playbook,
    expiry.expirationDate,
    expiryLabel,
  );
  return NextResponse.json(result);
}
