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
    const limit = parseInt(req.query.limit as string || "50", 10);
    const offset = (page - 1) * limit;

    let rides = await storage.getRides(offset, limit);
    const { origin, destination, date, time, timeWindow, genderPref, yearPref, isRecurring } = req.query as Record<string, string>;

    if (origin) {
      rides = rides.filter(r => r.origin?.toLowerCase().includes(origin.toLowerCase()));
    }
    if (destination) {
      rides = rides.filter(r => r.destination?.toLowerCase().includes(destination.toLowerCase()));
    }
    if (date) {
      rides = rides.filter(r => r.date === date);
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

// GET /api/rides/smart-matches
router.get("/smart-matches", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const allRides = await storage.getRides(0, 100);

    const candidates = await Promise.all(
      allRides.map(async (ride) => {
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

export default router;

