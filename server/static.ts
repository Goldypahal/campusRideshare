import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // Support both src execution and dist/index.js execution
  const distPath = path.resolve(__dirname, "public");
  const fallbackPath = path.resolve(__dirname, "..", "dist", "public");
  const finalDistPath = fs.existsSync(distPath) ? distPath : fallbackPath;

  if (!fs.existsSync(finalDistPath)) {
    throw new Error(
      `Could not find the build directory: ${finalDistPath}, make sure to build the client first with npm run build:web`
    );
  }

  app.use(express.static(finalDistPath));

  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(finalDistPath, "index.html"));
  });
}
