import { Router, type Response, type NextFunction } from "express";
import { authenticateToken, type AuthRequest } from "./auth.routes";
import {
  getEnabledProviders,
  getProvider,
  lookupKnownPlace,
  handoffRequestSchema,
} from "../services/external-rides";
import { storage } from "../storage";
import { logTelemetryEvent } from "../services/telemetry.service";
import { NotFoundError } from "../errors";
import { env } from "../env";

const router = Router();

// In-memory rate limiter: max 20 handoffs per user per 10 minutes
const handoffRateMap = new Map<string, { count: number; resetTime: number }>();
function handoffRateLimiter(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return next();

  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxHandoffs = 20;

  const record = handoffRateMap.get(userId);
  if (!record || now > record.resetTime) {
    handoffRateMap.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxHandoffs) {
    return res.status(429).json({
      type: "urn:problem:rate-limited",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "External ride handoff rate limit exceeded. Please wait a moment before requesting more external rides.",
      message: "External ride handoff rate limit exceeded. Please wait a moment before requesting more external rides.",
    });
  }

  record.count += 1;
  next();
}

// GET /api/external-rides/providers
router.get("/providers", authenticateToken, (_req: AuthRequest, res: Response) => {
  const enabled = getEnabledProviders();
  const providers = enabled.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    modes: p.modes,
    capabilities: p.capabilities,
  }));

  res.json({
    providers,
    settings: {
      matchThreshold: env.EXTERNAL_RIDES_MATCH_THRESHOLD,
      soonMinutes: env.EXTERNAL_RIDES_SOON_MINUTES,
    },
  });
});

// POST /api/external-rides/handoffs
router.post(
  "/handoffs",
  authenticateToken,
  handoffRateLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = handoffRequestSchema.parse(req.body);

      const provider = getProvider(body.providerId);
      if (!provider || !provider.isEnabled()) {
        return next(new NotFoundError("External ride provider not found or disabled"));
      }

      // Resolve coordinates only through verified GPS inputs or exact landmark dictionary
      // (NEVER invoke resolveCoordinates or invent coordinates)
      const verifiedPickup = { ...body.pickup };
      if (verifiedPickup.lat == null || verifiedPickup.lng == null) {
        const known = lookupKnownPlace(verifiedPickup.label);
        if (known) {
          verifiedPickup.lat = known.lat;
          verifiedPickup.lng = known.lng;
        }
      }

      const verifiedDropoff = { ...body.dropoff };
      if (verifiedDropoff.lat == null || verifiedDropoff.lng == null) {
        const known = lookupKnownPlace(verifiedDropoff.label);
        if (known) {
          verifiedDropoff.lat = known.lat;
          verifiedDropoff.lng = known.lng;
        }
      }

      const handoffResult = provider.buildHandoff({
        pickup: verifiedPickup,
        dropoff: verifiedDropoff,
        platform: body.platform,
        context: body.context,
      });

      const hadPickupCoords = Boolean(verifiedPickup.lat != null && verifiedPickup.lng != null);
      const hadDropoffCoords = Boolean(verifiedDropoff.lat != null && verifiedDropoff.lng != null);

      // Data minimization: Audit record contains provider & timestamp, but no location data
      const handoffRecord = await storage.createExternalRideHandoff({
        userId: req.user!.id,
        providerId: provider.id,
        reason: body.context?.reason || "manual",
        hadPickupCoords,
        hadDropoffCoords,
      });

      // Telemetry without raw coordinates
      logTelemetryEvent("EXTERNAL_RIDE_HANDOFF", req.user!.id, undefined, {
        provider: provider.id,
        reason: body.context?.reason || "manual",
        hadPickupCoords,
        hadDropoffCoords,
      });

      res.status(201).json({
        handoffId: handoffRecord.id,
        url: handoffResult.url,
        prefilled: handoffResult.prefilled,
        disclosure: {
          safety: "CampusRide's safety features (SOS alerts, verified university community, trip tracking) do not cover rides taken through third-party services. Please use the provider's built-in emergency tools and dial 112 for immediate assistance.",
          privacy: "Opening the provider link shares your pickup and drop-off locations directly with that provider. No location coordinates or addresses are stored in CampusRide's external ride audit logs.",
        },
      });
    } catch (err: any) {
      next(err);
    }
  }
);

export default router;
