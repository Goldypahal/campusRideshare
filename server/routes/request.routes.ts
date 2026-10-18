import { Router, type Response } from "express";
import { storage } from "../storage";
import { insertRideRequestSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";
import { logTelemetryEvent } from "../services/telemetry.service";

const router = Router();

// POST /api/ride-requests
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const requestData = insertRideRequestSchema.parse(req.body);
    const seatsRequested = requestData.seatsRequested || 1;

    const ride = await storage.getRide(requestData.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driverId === req.user!.id) {
      return res.status(400).json({ message: "Cannot request your own ride" });
    }

    if (ride.status !== "active") {
      return res.status(400).json({ message: `Cannot request a ride that is ${ride.status}` });
    }

    if (ride.availableSeats < seatsRequested) {
      return res.status(400).json({
        message: `Not enough seats available. Requested: ${seatsRequested}, Available: ${ride.availableSeats}`,
      });
    }

    const existingRequests = await storage.getRideRequestsByRide(requestData.rideId);
    const hasExistingActiveRequest = existingRequests.some(
      r => r.passengerId === req.user!.id && ["pending", "accepted"].includes(r.status ?? "")
    );
    if (hasExistingActiveRequest) {
      return res.status(400).json({ message: "You already have an active or pending request for this ride" });
    }

    const rideRequest = await storage.createRideRequest({
      ...requestData,
      seatsRequested,
      passengerId: req.user!.id,
    });

    logTelemetryEvent("REQUEST_RIDE", req.user!.id, rideRequest.rideId, { seatsRequested });

    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(ride.driverId, {
        type: "ride_request_created",
        request: rideRequest,
        ride,
      });
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
    if (!["accepted", "rejected", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Allowed: accepted, rejected, cancelled" });
    }

    // Cancellation workflow (by passenger or driver)
    if (status === "cancelled") {
      const cancelResult = await storage.cancelRideRequestAtomic(req.params.id, req.user!.id);
      if (!cancelResult.success) {
        return res.status(cancelResult.statusCode || 400).json({ message: cancelResult.error });
      }

      logTelemetryEvent("CANCEL_RIDE", req.user!.id, cancelResult.request?.rideId);

      // Notify the other party
      if ((req.app as any).sendToUser && cancelResult.request && cancelResult.ride) {
        const targetUserId = req.user!.id === cancelResult.request.passengerId
          ? cancelResult.ride.driverId
          : cancelResult.request.passengerId;

        (req.app as any).sendToUser(targetUserId, {
          type: "ride_request_cancelled",
          request: cancelResult.request,
          ride: cancelResult.ride,
        });
      }

      return res.json(cancelResult.request);
    }

    // Rejection workflow (driver only)
    if (status === "rejected") {
      const request = await storage.getRideRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const ride = await storage.getRide(request.rideId);
      if (!ride || ride.driverId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this request" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: `Cannot reject a request that is already ${request.status}` });
      }

      const updatedRequest = await storage.updateRideRequest(req.params.id, { status: "rejected" });
      logTelemetryEvent("REJECT_REQUEST", req.user!.id, request.rideId);

      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(request.passengerId, {
          type: "ride_request_status",
          request: updatedRequest,
          ride,
        });
      }
      return res.json(updatedRequest);
    }

    // Atomic seat reservation for "accepted" (driver only)
    const result = await storage.acceptRideRequestAtomic(req.params.id, req.user!.id);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ message: result.error });
    }

    if (result.request) {
      logTelemetryEvent("ACCEPT_REQUEST", req.user!.id, result.request.rideId);
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

// POST /api/ride-requests/:id/cancel (convenience endpoint)
router.post("/:id/cancel", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const cancelResult = await storage.cancelRideRequestAtomic(req.params.id, req.user!.id);
    if (!cancelResult.success) {
      return res.status(cancelResult.statusCode || 400).json({ message: cancelResult.error });
    }

    logTelemetryEvent("CANCEL_RIDE", req.user!.id, cancelResult.request?.rideId);

    if ((req.app as any).sendToUser && cancelResult.request && cancelResult.ride) {
      const targetUserId = req.user!.id === cancelResult.request.passengerId
        ? cancelResult.ride.driverId
        : cancelResult.request.passengerId;

      (req.app as any).sendToUser(targetUserId, {
        type: "ride_request_cancelled",
        request: cancelResult.request,
        ride: cancelResult.ride,
      });
    }

    res.json(cancelResult.request);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
