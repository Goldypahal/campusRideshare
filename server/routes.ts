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
  app.use("/api/ratings", ratingRouter);
  app.use("/api", ratingRouter); // Backward compatibility
  app.use("/api/safety", safetyRouter);
  app.use("/api", safetyRouter); // Backward compatibility for /api/sos

  // -------------------- HARDENED AUTHENTICATED WEBSOCKET SERVER --------------------
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("error", (err) => {
    console.warn("WSS server warning:", err.message);
  });

  interface AuthenticatedSocket extends WebSocket {
    userId?: string;
    isAlive?: boolean;
    subscribedRides?: Set<string>;
    msgCount?: number;
    lastMsgReset?: number;
  }

  const userSockets = new Map<string, Set<AuthenticatedSocket>>();
  const rideSockets = new Map<string, Set<AuthenticatedSocket>>();
  const incidentSockets = new Set<AuthenticatedSocket>();

  // Heartbeat ping interval: detect disconnected clients and clean up memory
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const socket = client as AuthenticatedSocket;
      if (socket.isAlive === false) {
        socket.terminate();
        return;
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 30000);
  heartbeatInterval.unref();

  httpServer.on("close", () => {
    clearInterval(heartbeatInterval);
    wss.close();
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", (socket: AuthenticatedSocket, req) => {
    socket.isAlive = true;
    socket.subscribedRides = new Set<string>();
    socket.msgCount = 0;
    socket.lastMsgReset = Date.now();

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("error", (err) => {
      console.warn("WS client socket error:", err.message);
    });

    // 1. Connection-time token extraction & authentication
    let authenticatedUserId: string | null = null;
    let authTimeout: NodeJS.Timeout | null = null;

    try {
      const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token");

      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        authenticatedUserId = decoded.id;
        bindUserSocket(socket, authenticatedUserId);
      }
    } catch (err: any) {
      console.warn("WS: Connection token invalid:", err.message);
    }

    // If no token in URL, give a 3-second grace window for immediate { type: "auth", token } message
    if (!authenticatedUserId) {
      authTimeout = setTimeout(() => {
        if (!socket.userId) {
          console.warn("WS: Unauthenticated socket connection timed out, closing (4401)");
          socket.close(4401, "Authentication required within 3 seconds");
        }
      }, 3000);
    }

    socket.on("message", (msg) => {
      // Socket rate limiting: max 30 messages per 10 seconds
      const now = Date.now();
      if (now - (socket.lastMsgReset || 0) > 10000) {
        socket.msgCount = 1;
        socket.lastMsgReset = now;
      } else {
        socket.msgCount = (socket.msgCount || 0) + 1;
        if (socket.msgCount > 30) {
          socket.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
          return;
        }
      }

      try {
        const data = JSON.parse(msg.toString());

        // Handle inline auth token if not provided in URL
        if (data.type === "auth" && data.token) {
          try {
            const decoded = jwt.verify(data.token, JWT_SECRET) as { id: string };
            authenticatedUserId = decoded.id;
            bindUserSocket(socket, authenticatedUserId);
            if (authTimeout) clearTimeout(authTimeout);
            socket.send(JSON.stringify({ type: "auth_success", userId: authenticatedUserId }));
          } catch {
            socket.close(4401, "Invalid auth token");
          }
          return;
        }

        // Must be authenticated for any subsequent operations
        if (!socket.userId) {
          socket.send(JSON.stringify({ type: "error", message: "Unauthorized socket" }));
          return;
        }

        if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
          return;
        }

        // Ride room subscription
        if (data.type === "subscribe_ride" && data.rideId) {
          const rideId = String(data.rideId);
          if (!rideSockets.has(rideId)) {
            rideSockets.set(rideId, new Set());
          }
          rideSockets.get(rideId)!.add(socket);
          socket.subscribedRides?.add(rideId);
          socket.send(JSON.stringify({ type: "subscribed_ride", rideId }));
          return;
        }

        if (data.type === "unsubscribe_ride" && data.rideId) {
          const rideId = String(data.rideId);
          rideSockets.get(rideId)?.delete(socket);
          socket.subscribedRides?.delete(rideId);
          socket.send(JSON.stringify({ type: "unsubscribed_ride", rideId }));
          return;
        }

        // Safety handler channel subscription
        if (data.type === "subscribe_incident_stream") {
          incidentSockets.add(socket);
          socket.send(JSON.stringify({ type: "subscribed_incident_stream" }));
          return;
        }
      } catch (err: any) {
        socket.send(JSON.stringify({ type: "error", message: "Malformed JSON payload" }));
      }
    });

    socket.on("close", () => {
      if (authTimeout) clearTimeout(authTimeout);
      cleanupSocket(socket);
    });
  });

  function bindUserSocket(socket: AuthenticatedSocket, userId: string) {
    socket.userId = userId;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket);
    console.log(`WS: User ${userId} successfully bound and authenticated`);
  }

  function cleanupSocket(socket: AuthenticatedSocket) {
    if (socket.userId && userSockets.has(socket.userId)) {
      userSockets.get(socket.userId)!.delete(socket);
      if (userSockets.get(socket.userId)!.size === 0) {
        userSockets.delete(socket.userId);
      }
    }
    if (socket.subscribedRides) {
      for (const rideId of socket.subscribedRides) {
        rideSockets.get(rideId)?.delete(socket);
        if (rideSockets.get(rideId)?.size === 0) {
          rideSockets.delete(rideId);
        }
      }
    }
    incidentSockets.delete(socket);
  }

  // Targeted event dispatcher: Send directly to specific user
  function sendToUser(userId: string, event: any) {
    try {
      const raw = JSON.stringify(event);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) c.send(raw);
        });
      }
    } catch (e) {
      console.error("WS sendToUser error", e);
    }
  }

  // Targeted event dispatcher: Send to participants subscribed to a specific ride room
  function sendToRide(rideId: string, event: any) {
    try {
      const raw = JSON.stringify(event);
      const sockets = rideSockets.get(rideId);
      if (sockets) {
        sockets.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) c.send(raw);
        });
      }
    } catch (e) {
      console.error("WS sendToRide error", e);
    }
  }

  // Targeted event dispatcher: Send to emergency/safety incident responders
  function sendToIncidentHandlers(event: any) {
    try {
      const raw = JSON.stringify(event);
      incidentSockets.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) c.send(raw);
      });
    } catch (e) {
      console.error("WS sendToIncidentHandlers error", e);
    }
  }

  // Public system broadcast (only for system-level notifications, never for private rides or SOS alerts)
  function broadcastPublicEvent(event: any) {
    try {
      const raw = JSON.stringify(event);
      wss.clients.forEach((c) => {
        const sock = c as AuthenticatedSocket;
        if (sock.userId && sock.readyState === WebSocket.OPEN) {
          sock.send(raw);
        }
      });
    } catch (e) {
      console.error("WS broadcastPublicEvent error", e);
    }
  }

  (app as any).sendToUser = sendToUser;
  (app as any).sendToRide = sendToRide;
  (app as any).sendToIncidentHandlers = sendToIncidentHandlers;
  (app as any).getConnectedRespondersCount = () => incidentSockets.size;
  (app as any).broadcastPublicEvent = broadcastPublicEvent;
  // Keep broadcastWS backward-compatible for existing calls but make it safe (authenticated only)
  (app as any).broadcastWS = broadcastPublicEvent;

  return httpServer;
}
