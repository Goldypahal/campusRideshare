import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertRatingSchema } from "@shared/schema";
import { authenticateToken, requireVerified, type AuthRequest } from "./auth.routes";

const router = Router();

// POST /api/ratings (Requires institutional email verification)
router.post("/", authenticateToken, requireVerified, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ratingData = insertRatingSchema.parse(req.body);
    const result = await storage.createRatingEligible({ ...ratingData, fromUserId: req.user!.id });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        type: "urn:problem:validation-error",
        title: "Rating Not Allowed",
        status: result.statusCode || 400,
        detail: result.error,
        message: result.error,
      });
    }
    res.status(201).json(result.rating);
  } catch (error: any) {
    next(error);
  }
});

// GET /api/users/:id/ratings
router.get("/users/:id/ratings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ratings = await storage.getRatingsByUser(req.params.id);
    res.json(ratings);
  } catch (error: any) {
    next(error);
  }
});

export default router;
