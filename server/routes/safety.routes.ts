import { Router, type Response } from "express";
import { storage } from "../storage";
import { insertSafetyIncidentSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";
import { logTelemetryEvent } from "../services/telemetry.service";

const router = Router();

// POST /api/safety/incidents or /api/sos (Emergency Trigger)
async function handleCreateIncident(req: AuthRequest, res: Response) {
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

    // Durable database storage
    const incident = await storage.createSafetyIncident(validatedData);
    const user = await storage.getUser(req.user!.id);

    const alertPayload = {
      type: "safety_incident",
      incident: {
        ...incident,
        userName: user?.fullName || user?.email,
      },
    };

    // 1. Dispatch directly to campus emergency handlers & monitors
    if ((req.app as any).sendToIncidentHandlers) {
      (req.app as any).sendToIncidentHandlers(alertPayload);
    }

    // 2. Dispatch to participants of this specific ride if in-transit
    if (rideId && (req.app as any).sendToRide) {
      (req.app as any).sendToRide(rideId, alertPayload);
    }

    // 3. Confirm to the user's socket
    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(req.user!.id, {
        type: "incident_confirmed",
        incidentId: incident.id,
        status: incident.status,
      });
    }

    logTelemetryEvent("CREATE_RIDE", req.user!.id, rideId, {
      emergencyIncidentId: incident.id,
      severity: incident.severity,
    });

    res.status(201).json({
      ok: true,
      incident,
      deliveryStatus: "persisted_and_dispatched_to_responders",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

router.post("/incidents", authenticateToken, handleCreateIncident);
router.post("/sos", authenticateToken, handleCreateIncident); // Backward compatibility

// GET /api/safety/incidents/active (Emergency Monitor Dashboard)
router.get("/incidents/active", authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const activeIncidents = await storage.listActiveIncidents();
    res.json(activeIncidents);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/safety/incidents/:id
router.get("/incidents/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const incident = await storage.getSafetyIncident(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    res.json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/safety/incidents/:id/acknowledge
router.patch("/incidents/:id/acknowledge", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const incident = await storage.getSafetyIncident(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    const updated = await storage.updateSafetyIncident(req.params.id, {
      status: "acknowledged",
      acknowledgedBy: req.user!.id,
      acknowledgedAt: new Date(),
    });

    // Notify incident creator that responders acknowledged the emergency
    if ((req.app as any).sendToUser && incident.userId) {
      (req.app as any).sendToUser(incident.userId, {
        type: "incident_acknowledged",
        incidentId: req.params.id,
      });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/safety/incidents/:id/resolve
router.patch("/incidents/:id/resolve", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const incident = await storage.getSafetyIncident(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });

    const updated = await storage.updateSafetyIncident(req.params.id, {
      status: "resolved",
      resolvedAt: new Date(),
    });

    if ((req.app as any).sendToUser && incident.userId) {
      (req.app as any).sendToUser(incident.userId, {
        type: "incident_resolved",
        incidentId: req.params.id,
      });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
