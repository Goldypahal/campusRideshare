import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertRideRequestSchema } from "@shared/schema";
import { authenticateToken, requireVerified, type AuthRequest } from "./auth.routes";
import { logTelemetryEvent } from "../services/telemetry.service";
import { ValidationError, NotFoundError, ConflictError } from "../errors";

const router = Router();

// POST /api/ride-requests (Request a Ride - Requires institutional email verification)
router.post("/", authenticateToken, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requestData = insertRideRequestSchema.parse(req.body);
    const seatsRequested = requestData.seatsRequested || 1;

    const ride = await storage.getRide(requestData.rideId);
    if (!ride) return next(new NotFoundError("Ride not found"));

    if (ride.driverId === req.user!.id) {
      return next(new ValidationError("Cannot request your own ride"));
    }

    if (ride.status !== "active") {
      return next(new ValidationError(`Cannot request a ride that is ${ride.status}`));
    }

    if (ride.availableSeats < seatsRequested) {
      return next(
        new ValidationError(
          `Not enough seats available. Requested: ${seatsRequested}, Available: ${ride.availableSeats}`
        )
      );
    }

    const existingRequests = await storage.getRideRequestsByRide(requestData.rideId);
    const hasExistingActiveRequest = existingRequests.some(
      (r) => r.passengerId === req.user!.id && ["pending", "accepted"].includes(r.status ?? "")
    );
    if (hasExistingActiveRequest) {
      return next(new ConflictError("You already have an active or pending request for this ride"));
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
    next(error);
  }
});

// GET /api/ride-requests/my
router.get("/my", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const requests = await storage.getRideRequestsByPassenger(req.user!.id);
    const requestsWithRides = await Promise.all(
      requests.map(async (request) => {
        const ride = await storage.getRide(request.rideId);
        const driver = ride ? await storage.getUser(ride.driverId) : null;
        return {
          ...request,
          ride: ride ? { ...ride, driver: driver ? { ...driver, password: undefined } : null } : null,
        };
      })
    );
    res.json(requestsWithRides);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/ride-requests/driver/incoming
router.get("/driver/incoming", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rides = await storage.getRidesByDriver(req.user!.id);
    const allRequests = await Promise.all(
      rides.map(async (ride) => {
        const requests = await storage.getRideRequestsByRide(ride.id);
        const requestsWithPassengers = await Promise.all(
          requests.map(async (request) => {
            const passenger = await storage.getUser(request.passengerId);
            return {
              ...request,
              passenger: passenger ? { ...passenger, password: undefined } : null,
              ride,
            };
          })
        );
        return requestsWithPassengers;
      })
    );
    res.json(allRequests.flat());
  } catch (error: any) {
    next(error);
  }
});

// PATCH /api/ride-requests/:id
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const request = await storage.getRideRequest(req.params.id);
    if (!request) return next(new NotFoundError("Request not found"));

    const ride = await storage.getRide(request.rideId);
    if (!ride) return next(new NotFoundError("Associated ride not found"));

    const { status } = req.body;
    const allowedStatuses = ["accepted", "rejected", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return next(new ValidationError(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`));
    }

    const isDriver = ride.driverId === req.user!.id;
    const isPassenger = request.passengerId === req.user!.id;

    if (status === "accepted" || status === "rejected") {
      if (!isDriver) {
        return res.status(403).json({
          type: "urn:problem:forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Only the driver can accept or reject requests",
          message: "Only the driver can accept or reject requests",
        });
      }
    }

    if (status === "cancelled") {
      if (!isPassenger && !isDriver) {
        return res.status(403).json({
          type: "urn:problem:forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Not authorized to cancel this request",
          message: "Not authorized to cancel this request",
        });
      }
    }

    // Atomic seat allocation via storage transaction method
    if (status === "accepted" && request.status !== "accepted") {
      const reservation = await storage.acceptRideRequestAtomic(request.id, req.user!.id);
      if (!reservation.success) {
        return res.status(400).json({
          type: "urn:problem:conflict",
          title: "Reservation Conflict",
          status: 400,
          detail: reservation.error || "Cannot accept request: not enough seats available.",
          message: reservation.error || "Cannot accept request: not enough seats available.",
        });
      }

      logTelemetryEvent("ACCEPT_REQUEST", req.user!.id, ride.id, { requestId: request.id });

      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(request.passengerId, {
          type: "ride_request_accepted",
          request: reservation.request,
          ride: reservation.ride,
        });
      }
      return res.json(reservation.request);
    }

    // Cancellation: restore seats if cancelling an accepted booking
    if (status === "cancelled" && request.status === "accepted") {
      const cancellation = await storage.cancelRideRequestAtomic(request.id, req.user!.id);
      if (!cancellation.success) {
        return res.status(400).json({
          type: "urn:problem:validation-error",
          title: "Cancellation Error",
          status: 400,
          detail: cancellation.error,
          message: cancellation.error,
        });
      }
      return res.json(cancellation.request);
    }

    const updatedRequest = await storage.updateRideRequest(request.id, { status });

    if (status === "rejected") {
      logTelemetryEvent("REJECT_REQUEST", req.user!.id, ride.id, { requestId: request.id });
    }

    if ((req.app as any).sendToUser) {
      const notifyUserId = isDriver ? request.passengerId : ride.driverId;
      (req.app as any).sendToUser(notifyUserId, {
        type: `ride_request_${status}`,
        request: updatedRequest,
        ride,
      });
    }

    res.json(updatedRequest);
  } catch (error: any) {
    next(error);
  }
});

export default router;
