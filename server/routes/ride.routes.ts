import { Router, type Response } from "express";
import { storage } from "../storage";
import { insertRideSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";
import { rankCandidateRidesML, calculateRideMatch } from "../services/matching.service";
import { logTelemetryEvent } from "../services/telemetry.service";

const router = Router();

// POST /api/rides
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rideData = insertRideSchema.parse(req.body);
    const ride = await storage.createRide({ ...rideData, driverId: req.user!.id });
    
    logTelemetryEvent("VIEW_RIDE", req.user!.id, ride.id, { action: "CREATE_RIDE", origin: ride.origin });

    if ((req.app as any).broadcastWS) {
      (req.app as any).broadcastWS({ type: "ride_created", ride });
    }
    res.status(201).json(ride);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/rides
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string || "1", 10);
    const limit = parseInt(req.query.limit as string || "20", 10);
    const { origin, destination, date, time, timeWindow, genderPref, yearPref, isRecurring, minSeats } = req.query as Record<string, string>;

    const searchResult = await storage.searchRides({
      origin,
      destination,
      date,
      time,
      timeWindow: timeWindow ? parseInt(timeWindow, 10) : undefined,
      genderPref,
      yearPref,
      isRecurring: isRecurring !== undefined ? isRecurring === "true" : undefined,
      minSeats: minSeats ? parseInt(minSeats, 10) : undefined,
      page,
      limit,
    });

    res.json(searchResult);
  } catch (error: any) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/rides/smart-matches
router.get("/smart-matches", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const allRides = await storage.getRides(0, 100);

    // Hard Constraint Filtering (Algorithm A):
    // 1. Must be active status
    // 2. Must have available seats
    // 3. Prevent self-matching (driver cannot match their own ride)
    const eligibleRides = allRides.filter((ride) => {
      if (ride.status !== "active") return false;
      if (ride.availableSeats <= 0) return false;
      if (ride.driverId === req.user!.id) return false;
      return true;
    });

    const candidates = await Promise.all(
      eligibleRides.map(async (ride) => {
        const driver = await storage.getUser(ride.driverId);
        return { ride, driver: driver || null };
      })
    );

    const queryParams = {
      origin: req.query.origin as string,
      destination: req.query.destination as string,
      date: req.query.date as string,
      time: req.query.time as string,
      timeWindow: req.query.timeWindow ? parseInt(req.query.timeWindow as string, 10) : undefined,
      genderPref: req.query.genderPref as string,
      yearPref: req.query.yearPref as string,
    };

    const rankedCandidates = await rankCandidateRidesML(candidates, queryParams);

    const formattedMatches = rankedCandidates.map((c) => ({
      ...c.ride,
      driver: c.driver,
      matchPercentage: c.matchScore,
      matchBreakdown: c.breakdown,
    }));

    logTelemetryEvent("VIEW_RIDE", req.user!.id, undefined, {
      query: queryParams,
      resultsCount: formattedMatches.length,
    });

    res.json(formattedMatches);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/rides/my
router.get("/my", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rides = await storage.getRidesByDriver(req.user!.id);
    res.json(rides);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/rides/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    const driver = await storage.getUser(ride.driverId);
    
    if (req.user?.id) {
      logTelemetryEvent("CLICK_RIDE", req.user.id, ride.id);
    }
    
    res.json({ ...ride, driver: driver ? { ...driver, password: undefined } : null });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/rides/:id (Driver can update status e.g. completed, cancelled, or details)
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driverId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized to update this ride" });
    }

    const { status, notes, vehicle } = req.body;
    const allowedStatuses = ["active", "full", "completed", "cancelled"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` });
    }

    const updatedRide = await storage.updateRide(req.params.id, {
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(vehicle !== undefined ? { vehicle } : {}),
    });

    if (status === "completed") {
      logTelemetryEvent("COMPLETE_RIDE", req.user!.id, ride.id);
    } else if (status === "cancelled") {
      logTelemetryEvent("CANCEL_RIDE", req.user!.id, ride.id);
    }

    if ((req.app as any).sendToRide) {
      (req.app as any).sendToRide(ride.id, {
        type: "ride_updated",
        ride: updatedRide,
      });
    }

    res.json(updatedRide);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

