const mysql = require("mysql2/promise");
(async () => {
  const conn = await mysql.createConnection({ uri: process.env.MYSQL_URL });
  const [rows] = await conn.query(`
    select * from ticker_ratings where symbol = 'NBIS'
  `);
  console.log(rows);
  process.exit(0);
})();
