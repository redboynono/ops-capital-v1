const mysql = require("mysql2/promise");
(async () => {
  const conn = await mysql.createConnection({ uri: process.env.MYSQL_URL });
  const [rows] = await conn.query(`
    select h.symbol, h.ops_verdict, h.quant_score, h.ops_target_price,
       cast(h.captured_at as char) as captured_at,
       row_number() over (partition by h.symbol order by h.captured_at desc) as rn
  from ticker_ratings_history h
 where h.symbol = 'AAPL'
 order by h.captured_at desc
 limit 5
  `);
  console.log(rows);
  process.exit(0);
})();
