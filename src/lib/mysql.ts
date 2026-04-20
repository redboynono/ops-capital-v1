import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getMySqlPool() {
  if (pool) return pool;

  const databaseUrl = process.env.MYSQL_URL;
  if (!databaseUrl) {
    throw new Error("Missing MYSQL_URL");
  }

  pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z",
  });

  return pool;
}

export async function mysqlQuery<T>(sql: string, params: unknown[] = []) {
  const [rows] = await getMySqlPool().query(sql, params);
  return rows as T;
}
