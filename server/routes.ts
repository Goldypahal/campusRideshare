import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  loginSchema,
  insertRideSchema,
  insertRideRequestSchema,
  insertMessageSchema,
  insertRatingSchema
} from "@shared/schema";
import bcrypt from "bcrypt";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "./env";

const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

// -------------------- Rate Limiter --------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "global";
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 mins window
  const maxRequests = 20;

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + limitWindow });
    return next();
  }
  if (record.count >= maxRequests) {
    return res.status(429).json({ message: "Too many authentication requests. Please try again later." });
  }
  record.count += 1;
  next();
};

// -------------------- Security Headers --------------------
const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
};

// -------------------- JWT Middleware --------------------
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Access token required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await storage.getUser(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(securityHeaders);

  // -------------------- AUTH ROUTES --------------------
  app.post("/api/auth/register", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await storage.createUser({ ...userData, password: hashedPassword });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/users/me", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { homeAirport, housingZone, major, academicYear } = req.body;
      const updatedUser = await storage.updateUser(req.user!.id, {
        ...(homeAirport !== undefined && { homeAirport }),
        ...(housingZone !== undefined && { housingZone }),
        ...(major !== undefined && { major }),
        ...(academicYear !== undefined && { academicYear }),
      });
      if (!updatedUser) return res.status(404).json({ message: "User not found" });
      res.json({ ...updatedUser, password: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/stats", async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      const userRides = await storage.getRidesByDriver(user.id);
      const userRequests = await storage.getRideRequestsByPassenger(user.id);
      const acceptedRequests = userRequests.filter(r => r.status === "accepted");

      const totalTrips = userRides.length + acceptedRequests.length;
      // Estimate CO2 savings: ~2.3 kg CO2 saved per shared ride (avg 15 mile trip)
      const co2SavedKg = Math.round(totalTrips * 2.3 * 10) / 10;
      // Estimate money saved: ~$12 per ride shared
      const moneySavedUsd = totalTrips * 12;

      res.json({
        userId: user.id,
        totalRidesOffered: userRides.length,
        totalRidesTaken: acceptedRequests.length,
        totalTrips,
        co2SavedKg,
        moneySavedUsd,
        rating: user.rating,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // -------------------- RIDE ROUTES --------------------
  app.post("/api/rides", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const rideData = insertRideSchema.parse(req.body);
      const ride = await storage.createRide({ ...rideData, driverId: req.user!.id });
      broadcastWS({ type: "ride_created", ride });
      res.status(201).json(ride);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/rides", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "50", 10);
      const offset = (page - 1) * limit;

      let rides = await storage.getRides(offset, limit);
      const { origin, destination, time, timeWindow, genderPref, yearPref, isRecurring } = req.query as Record<string, string>;

      if (origin) {
        rides = rides.filter(r => r.origin?.toLowerCase().includes(origin.toLowerCase()));
      }
      if (destination) {
        rides = rides.filter(r => r.destination?.toLowerCase().includes(destination.toLowerCase()));
      }

      if (isRecurring === "true") {
        rides = rides.filter(r => r.isRecurring === true);
      }

      if (time) {
        const window = parseInt(timeWindow || '15', 10) || 15;
        const toMinutes = (t: string) => {
          const [hh, mm] = t.split(':').map(x => parseInt(x, 10) || 0);
          return hh * 60 + mm;
        };
        const target = toMinutes(time);
        rides = rides.filter(r => {
          try {
            const rideMinutes = toMinutes(r.time);
            return Math.abs(rideMinutes - target) <= window;
          } catch {
            return true;
          }
        });
      }

      if (genderPref || yearPref) {
        const driverPromises = rides.map(r => storage.getUser(r.driverId));
        const drivers = await Promise.all(driverPromises);
        rides = rides.filter((r, idx) => {
          const d = drivers[idx];
          if (!d) return false;
          if (genderPref && d.gender.toLowerCase() !== genderPref.toLowerCase()) return false;
          if (yearPref && d.academicYear.toLowerCase() !== yearPref.toLowerCase()) return false;
          return true;
        });
      }

      const enhancedRides = await Promise.all(
        rides.map(async ride => {
          const driver = await storage.getUser(ride.driverId);
          return { ...ride, driver: driver ? { ...driver, password: undefined } : null };
        })
      );

      res.json(enhancedRides);
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/smart-matches", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const allRides = await storage.getRides(0, 100);
      const matches = allRides.filter(ride => {
        if (user.homeAirport && (ride.origin.toLowerCase().includes(user.homeAirport.toLowerCase()) || ride.destination.toLowerCase().includes(user.homeAirport.toLowerCase()))) {
          return true;
        }
        if (user.housingZone && (ride.destination.toLowerCase().includes(user.housingZone.toLowerCase()) || ride.origin.toLowerCase().includes(user.housingZone.toLowerCase()))) {
          return true;
        }
        return false;
      });

      const enhancedMatches = await Promise.all(
        matches.map(async ride => {
          const driver = await storage.getUser(ride.driverId);
          return { ...ride, driver: driver ? { ...driver, password: undefined } : null };
        })
      );

      res.json(enhancedMatches);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/my", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const rides = await storage.getRidesByDriver(req.user!.id);
      res.json(rides);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/:id", async (req: Request, res: Response) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      const driver = await storage.getUser(ride.driverId);
      res.json({ ...ride, driver: driver ? { ...driver, password: undefined } : null });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // -------------------- RIDE REQUEST ROUTES --------------------
  app.post("/api/ride-requests", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const requestData = insertRideRequestSchema.parse(req.body);
      const ride = await storage.getRide(requestData.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.driverId === req.user!.id) {
        return res.status(400).json({ message: "Cannot request your own ride" });
      }
      const existingRequests = await storage.getRideRequestsByRide(requestData.rideId);
      const hasExistingRequest = existingRequests.some(
        r => r.passengerId === req.user!.id && r.status === "pending"
      );
      if (hasExistingRequest) {
        return res.status(400).json({ message: "You already have a pending request for this ride" });
      }
      const rideRequest = await storage.createRideRequest({
        ...requestData,
        passengerId: req.user!.id,
      });

      sendToUser(ride.driverId, { type: "ride_request_created", request: rideRequest, ride });
      res.status(201).json(rideRequest);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ride-requests/my", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const requests = await storage.getRideRequestsByPassenger(req.user!.id);
      const enhancedRequests = await Promise.all(
        requests.map(async request => {
          const ride = await storage.getRide(request.rideId);
          let driver = null;
          if (ride) {
            const driverUser = await storage.getUser(ride.driverId);
            driver = driverUser ? { ...driverUser, password: undefined } : null;
          }
          return { ...request, ride, driver };
        })
      );
      res.json(enhancedRequests);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/ride-requests/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const request = await storage.getRideRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const ride = await storage.getRide(request.rideId);
      if (!ride || ride.driverId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }

      const updatedRequest = await storage.updateRideRequest(req.params.id, { status });
      if (status === "accepted" && ride.availableSeats > 0) {
        await storage.updateRide(ride.id, {
          availableSeats: ride.availableSeats - 1,
          status: ride.availableSeats - 1 === 0 ? "full" : "active",
        });
      }

      sendToUser(request.passengerId, { type: "ride_request_status", request: updatedRequest, ride });
      res.json(updatedRequest);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // -------------------- MESSAGES --------------------
  app.post("/api/messages", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage({ ...messageData, fromUserId: req.user!.id });
      sendToUser(messageData.toUserId, { type: "new_message", message });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/messages/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || "100", 10);
      const offset = parseInt(req.query.offset as string || "0", 10);
      const messages = await storage.getMessagesBetweenUsers(req.user!.id, req.params.userId, offset, limit);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // -------------------- RATINGS --------------------
  app.post("/api/ratings", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const ratingData = insertRatingSchema.parse(req.body);
      const rating = await storage.createRating({ ...ratingData, fromUserId: req.user!.id });
      res.status(201).json(rating);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/ratings", async (req: Request, res: Response) => {
    try {
      const ratings = await storage.getRatingsByUser(req.params.id);
      res.json(ratings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  app.post("/api/sos", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { latitude, longitude, message } = req.body;
      const user = await storage.getUser(req.user!.id);
      const sos = {
        id: Date.now().toString(),
        userId: req.user!.id,
        userName: user?.fullName || user?.email,
        latitude: latitude || null,
        longitude: longitude || null,
        message: message || "EMERGENCY SOS ALERT",
        createdAt: new Date().toISOString(),
      };
      broadcastWS({ type: "sos", sos });
      res.json({ ok: true, sos });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
