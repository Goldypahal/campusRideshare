import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertSafetyIncidentSchema } from "@shared/schema";
import { authenticateToken, requireRole, type AuthRequest } from "./auth.routes";
import { logTelemetryEvent } from "../services/telemetry.service";
import { NotFoundError, ForbiddenError, ValidationError } from "../errors";

const router = Router();

// POST /api/safety/incidents or /api/sos (Emergency Trigger)
async function handleCreateIncident(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { latitude, longitude, message, rideId, severity } = req.body;

    const validatedData = insertSafetyIncidentSchema.parse({
      userId: req.user!.id,
      rideId: rideId || undefined,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      message: message || "EMERGENCY SOS ALERT TRIGGERED",
      severity: severity || "critical",
      status: "active",
    });

    // 1. Determine responder connectivity to track honest delivery state
    const respondersOnline = (req.app as any).getConnectedRespondersCount
      ? (req.app as any).getConnectedRespondersCount()
      : 0;

    const initialDispatchStatus = respondersOnline > 0
      ? "delivered_to_responder"
      : "dispatch_pending";

    // 2. Durable database storage
    const incident = await storage.createSafetyIncident({
      ...validatedData,
      dispatchStatus: initialDispatchStatus,
    });
    const user = await storage.getUser(req.user!.id);

    const alertPayload = {
      type: "safety_incident",
      incident: {
        ...incident,
        userName: user?.fullName || user?.email,
      },
    };

    // 3. Dispatch directly to campus emergency handlers & monitors
    if ((req.app as any).sendToIncidentHandlers) {
      (req.app as any).sendToIncidentHandlers(alertPayload);
    }

    // 4. Dispatch to participants of this specific ride if in-transit
    if (rideId && (req.app as any).sendToRide) {
      (req.app as any).sendToRide(rideId, alertPayload);
    }

    // 5. Confirm to the user's socket
    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(req.user!.id, {
        type: "incident_confirmed",
        incidentId: incident.id,
        status: incident.status,
      });
    }

    logTelemetryEvent("EMERGENCY_SOS", req.user!.id, rideId, {
      emergencyIncidentId: incident.id,
      severity: incident.severity,
      respondersOnline,
    });

    const deliveryStatus = respondersOnline > 0
      ? "dispatched_to_active_responders"
      : "persisted_queued_for_responders";

    res.status(201).json({
      ok: true,
      incident,
      deliveryStatus,
      respondersOnline,
    });
  } catch (error: any) {
    next(error);
  }
}

router.post("/incidents", authenticateToken, handleCreateIncident);
router.post("/sos", authenticateToken, handleCreateIncident); // Backward compatibility

// GET /api/safety/incidents/active (Emergency Monitor Dashboard - Responders & Admins Only)
router.get(
  "/incidents/active",
  authenticateToken,
  requireRole(["responder", "admin"]),
  async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const activeIncidents = await storage.listActiveIncidents();
      res.json(activeIncidents);
    } catch (error: any) {
      next(error);
    }
  }
);

// GET /api/safety/incidents/:id (Restricted to Creator, Involved Co-riders, or Responders)
router.get("/incidents/:id", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const incident = await storage.getSafetyIncident(req.params.id);
    if (!incident) return next(new NotFoundError("Incident not found"));

    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role || "student";

    const isCreator = incident.userId === currentUserId;
    const isStaff = ["responder", "admin"].includes(currentUserRole);

    let isRideParticipant = false;
    if (incident.rideId) {
      const ride = await storage.getRide(incident.rideId);
      if (ride) {
        if (ride.driverId === currentUserId) {
          isRideParticipant = true;
        } else {
          const reqs = await storage.getRideRequestsByRide(incident.rideId);
          isRideParticipant = reqs.some(
            (r) => r.passengerId === currentUserId && r.status === "accepted"
          );
        }
      }
    }

    if (!isCreator && !isStaff && !isRideParticipant) {
      return res.status(403).json({
        type: "urn:problem:forbidden",
        title: "Access Denied",
        status: 403,
        detail: "Access denied: You are not authorized to view this emergency incident record.",
        message: "Access denied: You are not authorized to view this emergency incident record.",
      });
    }

    // Audit access to sensitive incident records
    logTelemetryEvent("SAFETY_INCIDENT_ACCESSED", currentUserId, incident.rideId || undefined, {
      incidentId: req.params.id,
      role: currentUserRole,
    });

    res.json(incident);
  } catch (error: any) {
    next(error);
  }
});

// PATCH /api/safety/incidents/:id/acknowledge (Designated responders acknowledge active emergency)
router.patch(
  "/incidents/:id/acknowledge",
  authenticateToken,
  requireRole(["responder", "admin"]),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const incident = await storage.getSafetyIncident(req.params.id);
      if (!incident) return next(new NotFoundError("Incident not found"));

      if (incident.status !== "active") {
        return next(new ValidationError(`Cannot acknowledge incident with status: ${incident.status}`));
      }

      const updated = await storage.updateSafetyIncident(req.params.id, {
        status: "acknowledged",
        dispatchStatus: "acknowledged",
        acknowledgedBy: req.user!.id,
        acknowledgedAt: new Date(),
      });

      logTelemetryEvent("SAFETY_INCIDENT_ACKNOWLEDGED", req.user!.id, incident.rideId || undefined, {
        incidentId: req.params.id,
      });

      const notifyPayload = {
        type: "incident_acknowledged",
        incidentId: incident.id,
        acknowledgedBy: req.user!.id,
      };

      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(incident.userId, notifyPayload);
      }
      if ((req.app as any).sendToIncidentHandlers) {
        (req.app as any).sendToIncidentHandlers(notifyPayload);
      }

      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  }
);

// PATCH /api/safety/incidents/:id/resolve (Responders or Admins close out incident)
router.patch(
  "/incidents/:id/resolve",
  authenticateToken,
  requireRole(["responder", "admin"]),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const incident = await storage.getSafetyIncident(req.params.id);
      if (!incident) return next(new NotFoundError("Incident not found"));

      if (incident.status === "resolved") {
        return next(new ValidationError("Incident is already marked resolved"));
      }

      const updated = await storage.updateSafetyIncident(req.params.id, {
        status: "resolved",
        dispatchStatus: "resolved",
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      });

      logTelemetryEvent("SAFETY_INCIDENT_RESOLVED", req.user!.id, incident.rideId || undefined, {
        incidentId: req.params.id,
      });

      const notifyPayload = {
        type: "incident_resolved",
        incidentId: incident.id,
        resolvedBy: req.user!.id,
      };

      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(incident.userId, notifyPayload);
      }
      if ((req.app as any).sendToIncidentHandlers) {
        (req.app as any).sendToIncidentHandlers(notifyPayload);
      }

      res.json(updated);
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;
