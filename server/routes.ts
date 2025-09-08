import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, insertRideSchema, insertRideRequestSchema, insertMessageSchema, insertRatingSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

interface AuthRequest extends Express.Request {
  user?: { id: string; email: string };
}

// Middleware to verify JWT token
const authenticateToken = async (req: AuthRequest, res: Express.Response, next: Express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Generate JWT token
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        user: { ...user, password: undefined },
        token,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        user: { ...user, password: undefined },
        token,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ride routes
  app.post("/api/rides", authenticateToken, async (req, res) => {
    try {
      const rideData = insertRideSchema.parse(req.body);
      const ride = await storage.createRide({
        ...rideData,
        driverId: req.user!.id,
      });
      res.status(201).json(ride);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/rides", async (req, res) => {
    try {
      const rides = await storage.getRides();
      
      // Enhance rides with driver information
      const enhancedRides = await Promise.all(
        rides.map(async (ride) => {
          const driver = await storage.getUser(ride.driverId);
          return {
            ...ride,
            driver: driver ? { ...driver, password: undefined } : null,
          };
        })
      );

      res.json(enhancedRides);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/my", authenticateToken, async (req, res) => {
    try {
      const rides = await storage.getRidesByDriver(req.user!.id);
      res.json(rides);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/rides/:id", async (req, res) => {
    try {
      const ride = await storage.getRide(req.params.id);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      const driver = await storage.getUser(ride.driverId);
      res.json({
        ...ride,
        driver: driver ? { ...driver, password: undefined } : null,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Ride request routes
  app.post("/api/ride-requests", authenticateToken, async (req, res) => {
    try {
      const requestData = insertRideRequestSchema.parse(req.body);
      
      // Check if ride exists
      const ride = await storage.getRide(requestData.rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      // Check if user is not the driver
      if (ride.driverId === req.user!.id) {
        return res.status(400).json({ message: "Cannot request your own ride" });
      }

      // Check if user already has a pending request for this ride
      const existingRequests = await storage.getRideRequestsByRide(requestData.rideId);
      const hasExistingRequest = existingRequests.some(
        request => request.passengerId === req.user!.id && request.status === "pending"
      );
      
      if (hasExistingRequest) {
        return res.status(400).json({ message: "You already have a pending request for this ride" });
      }

      const rideRequest = await storage.createRideRequest({
        ...requestData,
        passengerId: req.user!.id,
      });

      res.status(201).json(rideRequest);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/ride-requests/my", authenticateToken, async (req, res) => {
    try {
      const requests = await storage.getRideRequestsByPassenger(req.user!.id);
      
      // Enhance with ride and driver information
      const enhancedRequests = await Promise.all(
        requests.map(async (request) => {
          const ride = await storage.getRide(request.rideId);
          let driver = null;
          if (ride) {
            const driverUser = await storage.getUser(ride.driverId);
            driver = driverUser ? { ...driverUser, password: undefined } : null;
          }
          return {
            ...request,
            ride,
            driver,
          };
        })
      );

      res.json(enhancedRequests);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/ride-requests/:id", authenticateToken, async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const request = await storage.getRideRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Check if user is the driver of the ride
      const ride = await storage.getRide(request.rideId);
      if (!ride || ride.driverId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }

      const updatedRequest = await storage.updateRideRequest(req.params.id, { status });
      
      // If accepted, decrease available seats
      if (status === "accepted" && ride.availableSeats > 0) {
        await storage.updateRide(ride.id, { 
          availableSeats: ride.availableSeats - 1,
          status: ride.availableSeats - 1 === 0 ? "full" : "active"
        });
      }

      res.json(updatedRequest);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Message routes
  app.post("/api/messages", authenticateToken, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage({
        ...messageData,
        fromUserId: req.user!.id,
      });
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/messages/:userId", authenticateToken, async (req, res) => {
    try {
      const messages = await storage.getMessagesBetweenUsers(req.user!.id, req.params.userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Rating routes
  app.post("/api/ratings", authenticateToken, async (req, res) => {
    try {
      const ratingData = insertRatingSchema.parse(req.body);
      const rating = await storage.createRating({
        ...ratingData,
        fromUserId: req.user!.id,
      });
      res.status(201).json(rating);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/users/:id/ratings", async (req, res) => {
    try {
      const ratings = await storage.getRatingsByUser(req.params.id);
      res.json(ratings);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
