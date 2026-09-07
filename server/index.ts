import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { checkDbConnection } from "./db";
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
    if (path.startsWith("/api") || path === "/health") {
      const logData = {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: duration,
        timestamp: new Date().toISOString(),
      };
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms [req:${requestId.slice(0, 8)}]`);
    }
  });

  next();
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
  const server = await registerRoutes(app);

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = env.NODE_ENV === "production" && status === 500
      ? "An unexpected internal server error occurred"
      : err.message || "Internal Server Error";

    console.error("❌ Application Error:", err);
    res.status(status).json({ message, status });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(env.PORT, 10);
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 CampusRideshare server running on port ${port} (${env.NODE_ENV})`);
  });
})();
