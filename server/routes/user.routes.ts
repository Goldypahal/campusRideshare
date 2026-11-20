import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { authenticateToken, type AuthRequest } from "./auth.routes";
import { updateProfileSchema } from "@shared/schema";
import { NotFoundError } from "../errors";

const router = Router();

// GET /api/users/:id/stats
router.get("/:id/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const user = await storage.getUser(userId);
    if (!user) {
      return next(new NotFoundError("User not found"));
    }

    const completed = user.completedRidesCount || 0;
    const total = user.totalRides || 0;
    const cancellations = user.cancellationCount || 0;

    // Environmental & economic impact estimation:
    // Avg campus commute: 15 km, 4.2 kg CO2 saved per shared carpool
    const co2SavedKg = Math.round(completed * 4.2 * 10) / 10;
    // Avg parking + fuel saved: ~150 INR / USD equivalent
    const moneySaved = completed * 150;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 100;

    res.json({
      userId: user.id,
      totalRides: total,
      completedRides: completed,
      cancellationCount: cancellations,
      trustScore: user.trustScore || 85,
      rating: user.rating || 0,
      completionRate,
      co2SavedKg,
      moneySaved,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return next(new NotFoundError("User not found"));
    }
    res.json({ ...user, password: undefined });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/me
router.patch("/me", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updateData = updateProfileSchema.parse(req.body);
    const updatedUser = await storage.updateUser(req.user!.id, {
      ...(updateData.fullName ? { fullName: updateData.fullName } : {}),
      ...(updateData.academicYear ? { academicYear: updateData.academicYear } : {}),
      ...(updateData.major ? { major: updateData.major } : {}),
      ...(updateData.homeAirport !== undefined ? { homeAirport: updateData.homeAirport || null } : {}),
      ...(updateData.housingZone !== undefined ? { housingZone: updateData.housingZone || null } : {}),
    });

    if (!updatedUser) return next(new NotFoundError("User not found"));

    res.json({ ...updatedUser, password: undefined });
  } catch (error) {
    next(error);
  }
});

export default router;
