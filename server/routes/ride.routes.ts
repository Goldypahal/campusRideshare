import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertRideSchema } from "@shared/schema";
import { authenticateToken, requireVerified, type AuthRequest } from "./auth.routes";
import { rankCandidateRidesML } from "../services/matching.service";
import { logTelemetryEvent } from "../services/telemetry.service";
import { ValidationError, NotFoundError, ForbiddenError } from "../errors";

const router = Router();

// POST /api/rides (Offer a Ride - Requires institutional email verification)
router.post("/", authenticateToken, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rideData = insertRideSchema.parse(req.body);
    const ride = await storage.createRide({ ...rideData, driverId: req.user!.id });

    logTelemetryEvent("VIEW_RIDE", req.user!.id, ride.id, { action: "CREATE_RIDE", origin: ride.origin });

    if ((req.app as any).broadcastWS) {
      (req.app as any).broadcastWS({ type: "ride_created", ride });
    }
    res.status(201).json(ride);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/rides
router.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const { origin, destination, date, time, timeWindow, genderPref, yearPref, isRecurring, minSeats } =
      req.query as Record<string, string>;

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
    next(error);
  }
});

// GET /api/rides/smart-matches
router.get("/smart-matches", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return next(new NotFoundError("User not found"));

    const allRides = await storage.getRides(0, 100);

    // Hard Constraint Filtering
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
    next(error);
  }
});

// GET /api/rides/my
router.get("/my", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rides = await storage.getRidesByDriver(req.user!.id);
    res.json(rides);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/rides/:id
router.get("/:id", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ride = await storage.getRide(req.params.id);
    if (!ride) return next(new NotFoundError("Ride not found"));
    const driver = await storage.getUser(ride.driverId);

    if (req.user?.id) {
      logTelemetryEvent("CLICK_RIDE", req.user.id, ride.id);
    }

    res.json({ ...ride, driver: driver ? { ...driver, password: undefined } : null });
  } catch (error: any) {
    next(error);
  }
});

// PATCH /api/rides/:id (Lifecycle State Machine & Guarded Transitions)
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ride = await storage.getRide(req.params.id);
    if (!ride) return next(new NotFoundError("Ride not found"));

    if (ride.driverId !== req.user!.id) {
      return next(new ForbiddenError("Not authorized to update this ride"));
    }

    const { status, notes, vehicle } = req.body;
    const allowedStatuses = ["active", "full", "completed", "cancelled"];
    if (status && !allowedStatuses.includes(status)) {
      return next(new ValidationError(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`));
    }

    // Guard: Prevent completing an already cancelled ride
    if (status === "completed" && ride.status === "cancelled") {
      return next(new ValidationError("Cannot mark a cancelled ride as completed"));
    }

    // Cascade cancellation: If driver cancels the ride, automatically cancel all associated bookings
    if (status === "cancelled" && ride.status !== "cancelled") {
      const activeRequests = await storage.getRideRequestsByRide(ride.id);
      for (const reqItem of activeRequests) {
        if (["pending", "accepted"].includes(reqItem.status ?? "")) {
          await storage.updateRideRequest(reqItem.id, { status: "cancelled" });
          if ((req.app as any).sendToUser) {
            (req.app as any).sendToUser(reqItem.passengerId, {
              type: "ride_cancelled_by_driver",
              rideId: ride.id,
              message: "The driver has cancelled this ride.",
            });
          }
        }
      }

      // Record driver cancellation strike
      const driver = await storage.getUser(ride.driverId);
      if (driver) {
        await storage.updateUser(driver.id, {
          cancellationCount: (driver.cancellationCount || 0) + 1,
        });
      }
    }

    // If completed: increment completed rides count for driver and accepted passengers
    if (status === "completed" && ride.status !== "completed") {
      const driver = await storage.getUser(ride.driverId);
      if (driver) {
        await storage.updateUser(driver.id, {
          completedRidesCount: (driver.completedRidesCount || 0) + 1,
          totalRides: (driver.totalRides || 0) + 1,
        });
      }

      const acceptedRequests = (await storage.getRideRequestsByRide(ride.id)).filter(
        (r) => r.status === "accepted"
      );
      for (const reqItem of acceptedRequests) {
        const passenger = await storage.getUser(reqItem.passengerId);
        if (passenger) {
          await storage.updateUser(passenger.id, {
            completedRidesCount: (passenger.completedRidesCount || 0) + 1,
            totalRides: (passenger.totalRides || 0) + 1,
          });
        }
      }
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
    next(error);
  }
});

export default router;
