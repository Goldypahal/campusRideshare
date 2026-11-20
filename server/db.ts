import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

function createPgPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  console.log("🔌 Initializing PostgreSQL Connection Pool via node-postgres (pg)...");

  const isLocalOrDocker =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("postgres:");

  const isSslRequired =
    !isLocalOrDocker &&
    (connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      process.env.NODE_ENV === "production");

  return new Pool({
    connectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export const pool = createPgPool();
export const db = pool ? drizzle(pool, { schema }) : null;

export async function checkDbConnection(): Promise<boolean> {
  if (!pool || !db) return false;
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
