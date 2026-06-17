const mysql = require("mysql2/promise");
(async () => {
  const conn = await mysql.createConnection({ uri: process.env.MYSQL_URL });
  const [rows] = await conn.query(`
    with ranked as (
      select h.symbol, t.name, h.ops_verdict, h.quant_score, h.ops_target_price,
             cast(h.captured_at as char) as captured_at,
             row_number() over (partition by h.symbol order by h.captured_at desc) as rn
        from ticker_ratings_history h
        inner join tickers t on t.symbol = h.symbol
    )
    select * from ranked where rn <= 2
  `);
  
  const bySym = new Map();
  for (const r of rows) {
    const arr = bySym.get(r.symbol) || [];
    arr.push(r);
    bySym.set(r.symbol, arr);
  }
  
  let changes = 0;
  for (const [sym, arr] of bySym) {
    const latest = arr.find(x => x.rn === 1);
    const prev = arr.find(x => x.rn === 2);
    if (!latest || !prev) continue;
    
    // Check if latest is within 72 hours
    if (new Date(latest.captured_at).getTime() < Date.now() - 72 * 3600 * 1000) continue;
    
    if (latest.ops_verdict && prev.ops_verdict && latest.ops_verdict !== prev.ops_verdict) changes++;
    if (latest.quant_score && prev.quant_score && Math.abs(Number(latest.quant_score) - Number(prev.quant_score)) >= 0.15) changes++;
    if (latest.ops_target_price && prev.ops_target_price && latest.ops_target_price !== prev.ops_target_price) changes++;
  }
  console.log("Changes with fixed SQL:", changes);
  process.exit(0);
})();
