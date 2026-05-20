require("dotenv").config({ path: ".env.production" });
const mysql = require("mysql2/promise");
(async () => {
  const conn = await mysql.createConnection({ uri: process.env.MYSQL_URL || process.env.DATABASE_URL });
  const [rows] = await conn.query(`
    select h.symbol, h.ops_verdict, h.quant_score, h.ops_target_price,
       cast(h.captured_at as char) as captured_at,
       row_number() over (partition by h.symbol order by h.captured_at desc) as rn
  from ticker_ratings_history h
 where h.captured_at >= date_sub(now(), interval 72 hour)
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
    
    if (latest.ops_verdict && prev.ops_verdict && latest.ops_verdict !== prev.ops_verdict) changes++;
    if (latest.quant_score && prev.quant_score && latest.quant_score !== prev.quant_score) changes++;
    if (latest.ops_target_price && prev.ops_target_price && latest.ops_target_price !== prev.ops_target_price) changes++;
  }
  console.log("Changes:", changes);
  process.exit(0);
})();
