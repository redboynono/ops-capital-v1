import { NextResponse } from "next/server";
import { resolveExpirySelection } from "@/lib/options-expiry";
import { buildSymbolExpiringOptionsPlaybook } from "@/lib/expiring-options-playbook";

export const dynamic = "force-dynamic";

/** GET /api/options/expiring/playbook?symbol=NVDA&week=next */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "";
  const expiry = resolveExpirySelection({
    week: url.searchParams.get("week") ?? undefined,
    exp: url.searchParams.get("exp") ?? undefined,
  });
  const result = await buildSymbolExpiringOptionsPlaybook(
    symbol,
    expiry.expirationDate,
    expiry.label,
  );
  return NextResponse.json(result);
}
