import { db } from "./db";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  if (!db) {
    console.log("ℹ️ No database connected. Skipping database migrations.");
    return;
  }

  // Check both source and build locations
  const migrationsFolder = [
    path.resolve(__dirname, "../migrations"),
    path.resolve(__dirname, "../../migrations"),
    path.resolve(process.cwd(), "migrations"),
  ].find((p) => fs.existsSync(p));

  if (!migrationsFolder) {
    console.warn("⚠️ Migrations folder not found. Skipping auto-migration.");
    return;
  }

  try {
    console.log(`🚀 Executing pending database migrations from: ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log("✅ Database schema is up to date.");
  } catch (err: any) {
    console.error("❌ Database migration execution failed:", err.message);
    throw err;
  }
}
