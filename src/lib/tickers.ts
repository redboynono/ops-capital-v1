import { mysqlQuery } from "@/lib/mysql";

export type TickerRow = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  updated_at: string;
};

export async function listAllTickers() {
  return mysqlQuery<TickerRow[]>(
    "select symbol, name, exchange, sector, updated_at from tickers order by exchange, symbol",
  );
}

export async function getTickerBySymbol(symbol: string) {
  const rows = await mysqlQuery<TickerRow[]>(
    "select symbol, name, exchange, sector, updated_at from tickers where symbol = ? limit 1",
    [symbol],
  );
  return rows[0] ?? null;
}

export async function listTickersForPost(postId: string) {
  return mysqlQuery<TickerRow[]>(
    `select t.symbol, t.name, t.exchange, t.sector, t.updated_at
     from post_tickers pt
     inner join tickers t on t.symbol = pt.symbol
     where pt.post_id = ?
     order by t.symbol`,
    [postId],
  );
}

export async function listRelatedTickers(symbol: string, sector: string | null, limit = 6) {
  if (!sector) {
    return mysqlQuery<TickerRow[]>(
      "select symbol, name, exchange, sector, updated_at from tickers where symbol != ? order by updated_at desc limit ?",
      [symbol, limit],
    );
  }
  return mysqlQuery<TickerRow[]>(
    "select symbol, name, exchange, sector, updated_at from tickers where sector = ? and symbol != ? order by symbol limit ?",
    [sector, symbol, limit],
  );
}

export async function upsertTicker(symbol: string, name?: string) {
  await mysqlQuery(
    `insert into tickers (symbol, name) values (?, ?)
     on duplicate key update name = values(name)`,
    [symbol.toUpperCase(), name ?? symbol.toUpperCase()],
  );
}

export async function setPostTickers(postId: string, symbols: string[]) {
  await mysqlQuery("delete from post_tickers where post_id = ?", [postId]);
  if (symbols.length === 0) return;
  const clean = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean)));
  for (const s of clean) {
    await upsertTicker(s);
  }
  const placeholders = clean.map(() => "(?, ?)").join(", ");
  const params: string[] = [];
  for (const s of clean) {
    params.push(postId, s);
  }
  await mysqlQuery(`insert ignore into post_tickers (post_id, symbol) values ${placeholders}`, params);
}

export async function listWatchlist(userId: string) {
  return mysqlQuery<TickerRow[]>(
    `select t.symbol, t.name, t.exchange, t.sector, t.updated_at
     from watchlist w
     inner join tickers t on t.symbol = w.symbol
     where w.user_id = ?
     order by w.created_at desc`,
    [userId],
  );
}

export async function addToWatchlist(userId: string, symbol: string) {
  await upsertTicker(symbol);
  await mysqlQuery(
    "insert ignore into watchlist (user_id, symbol) values (?, ?)",
    [userId, symbol.toUpperCase()],
  );
}

export async function removeFromWatchlist(userId: string, symbol: string) {
  await mysqlQuery(
    "delete from watchlist where user_id = ? and symbol = ?",
    [userId, symbol.toUpperCase()],
  );
}
