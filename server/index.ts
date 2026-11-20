import express, { type Request, Response } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { checkDbConnection } from "./db";
import { runMigrations } from "./migrate";
import { storage } from "./storage";
import { env } from "./env";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request ID & Structured Logging Middleware
app.use((req, res, next) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-ID", requestId);

  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path === "/health" || path === "/readyz" || path === "/livez") {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms [req:${requestId.slice(0, 8)}]`);
    }
  });

  next();
});

// Liveness & Readiness Probes (WS12)
app.get("/livez", (_req, res) => {
  res.status(200).json({ status: "alive", uptime: process.uptime() });
});

app.get("/readyz", async (_req, res) => {
  const isDbConnected = await checkDbConnection();
  if (isDbConnected || !process.env.DATABASE_URL) {
    res.status(200).json({ status: "ready", database: isDbConnected });
  } else {
    res.status(503).json({ status: "unhealthy", database: false });
  }
});

// Health Check Endpoints
const healthHandler = async (_req: Request, res: Response) => {
  const isDbConnected = await checkDbConnection();
  const memoryUsage = process.memoryUsage();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    database: {
      connected: isDbConnected,
      mode: process.env.DATABASE_URL ? "postgresql" : "in-memory-fallback",
    },
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

(async () => {
  // Run pending database migrations on startup if database is configured
  try {
    await runMigrations();
  } catch (err: any) {
    console.error("Migration execution error:", err.message);
  }

  // Bootstrap initial campus administrator if specified in environment
  if (process.env.ADMIN_EMAIL) {
    try {
      const admin = await storage.getUserByEmail(process.env.ADMIN_EMAIL);
      if (admin && admin.role !== "admin") {
        await storage.updateUser(admin.id, { role: "admin", isVerified: true });
        console.log(`🛡️ Bootstrapped administrator role for: ${admin.email}`);
      }
    } catch (e: any) {
      console.warn("Could not check initial admin bootstrap:", e.message);
    }
  }

  const server = await registerRoutes(app);

  if (process.env.NODE_ENV === "development") {
    // Dynamic import prevents vite from being bundled into production runtime
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } catch (err: any) {
      console.warn("Vite development server not found, falling back to static files:", err.message);
      serveStatic(app);
    }
  } else {
    serveStatic(app);
  }

  const port = parseInt(env.PORT, 10);
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 CampusRideshare server running on port ${port} (${env.NODE_ENV})`);
  });
})();
