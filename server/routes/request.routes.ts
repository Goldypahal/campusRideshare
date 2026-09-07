import { Router, type Response } from "express";
import { storage } from "../storage";
import { insertRideRequestSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";

const router = Router();

// POST /api/ride-requests
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
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

    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(ride.driverId, { type: "ride_request_created", request: rideRequest, ride });
    }
    res.status(201).json(rideRequest);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/ride-requests/my
router.get("/my", authenticateToken, async (req: AuthRequest, res: Response) => {
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

// PATCH /api/ride-requests/:id
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (status === "rejected") {
      const request = await storage.getRideRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const ride = await storage.getRide(request.rideId);
      if (!ride || ride.driverId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }

      const updatedRequest = await storage.updateRideRequest(req.params.id, { status: "rejected" });
      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(request.passengerId, { type: "ride_request_status", request: updatedRequest, ride });
      }
      return res.json(updatedRequest);
    }

    // Atomic seat reservation for "accepted"
    const result = await storage.acceptRideRequestAtomic(req.params.id, req.user!.id);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ message: result.error });
    }

    if ((req.app as any).sendToUser && result.request && result.ride) {
      (req.app as any).sendToUser(result.request.passengerId, {
        type: "ride_request_status",
        request: result.request,
        ride: result.ride,
      });
    }

    res.json(result.request);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
