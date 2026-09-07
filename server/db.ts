import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

neonConfig.webSocketConstructor = ws;

if (process.env.DATABASE_URL) {
  console.log("🔌 Initializing PostgreSQL Connection Pool via Neon Serverless...");
}

export const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;

export async function checkDbConnection(): Promise<boolean> {
  if (!pool || !db) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}
