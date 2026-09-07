import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "./env";
import authRouter from "./routes/auth.routes";
import rideRouter from "./routes/ride.routes";
import requestRouter from "./routes/request.routes";
import messageRouter from "./routes/message.routes";
import ratingRouter from "./routes/rating.routes";
import safetyRouter from "./routes/safety.routes";

const JWT_SECRET = env.JWT_SECRET;

// -------------------- Security Headers --------------------
const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(securityHeaders);

  // Mount Domain Routers
  app.use("/api/auth", authRouter);
  app.use("/api/rides", rideRouter);
  app.use("/api/ride-requests", requestRouter);
  app.use("/api/messages", messageRouter);
  app.use("/api", ratingRouter);
  app.use("/api", safetyRouter);

  // -------------------- AUTHENTICATED WEBSOCKET SERVER --------------------
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("error", (err) => {
    console.warn("WSS server warning:", err.message);
  });

  const userSockets = new Map<string, Set<WebSocket>>();

  wss.on("connection", (socket, req) => {
    let authenticatedUserId: string | null = null;

    socket.on("error", (err) => {
      console.warn("WS client socket error:", err.message);
    });

    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        authenticatedUserId = decoded.id;

        if (!userSockets.has(authenticatedUserId)) {
          userSockets.set(authenticatedUserId, new Set());
        }
        userSockets.get(authenticatedUserId)!.add(socket);
        console.log(`WS: User ${authenticatedUserId} connected and authenticated`);
      }
    } catch (err) {
      console.warn("WS: Unauthenticated socket connection");
    }

    socket.on("message", msg => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "auth" && data.token) {
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET) as { id: string };
            authenticatedUserId = decoded.id;
            if (!userSockets.has(authenticatedUserId)) {
              userSockets.set(authenticatedUserId, new Set());
            }
            userSockets.get(authenticatedUserId)!.add(socket);
            socket.send(JSON.stringify({ type: "auth_success", userId: authenticatedUserId }));
          } catch {
            socket.send(JSON.stringify({ type: "auth_error", message: "Invalid auth token" }));
          }
        }
        if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    });

    socket.on("close", () => {
      if (authenticatedUserId && userSockets.has(authenticatedUserId)) {
        userSockets.get(authenticatedUserId)!.delete(socket);
        if (userSockets.get(authenticatedUserId)!.size === 0) {
          userSockets.delete(authenticatedUserId);
        }
      }
      console.log("WS: Client disconnected");
    });
  });

  function broadcastWS(event: any) {
    try {
      const raw = JSON.stringify(event);
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(raw);
      });
    } catch (e) {
      console.error("WS broadcast error", e);
    }
  }

  function sendToUser(userId: string, event: any) {
    try {
      const raw = JSON.stringify(event);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.forEach(c => {
          if (c.readyState === WebSocket.OPEN) c.send(raw);
        });
      }
    } catch (e) {
      console.error("WS sendToUser error", e);
    }
  }

  (app as any).broadcastWS = broadcastWS;
  (app as any).sendToUser = sendToUser;

  return httpServer;
}
