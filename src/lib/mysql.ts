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
    // 显式锁 utf8mb4，防止 server 默认连接字符集为 latin1 时
    // 把 utf8 字节当 cp1252 重编码（曾导致 ops_picks 双重 mojibake）。
    charset: "utf8mb4",
  });

  return pool;
}

export async function mysqlQuery<T>(sql: string, params: unknown[] = []) {
  const [rows] = await getMySqlPool().query(sql, params);
  return rows as T;
}
