import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { insertRatingSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";

const router = Router();

// POST /api/ratings
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const ratingData = insertRatingSchema.parse(req.body);
    const result = await storage.createRatingEligible({ ...ratingData, fromUserId: req.user!.id });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ message: result.error });
    }
    res.status(201).json(result.rating);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/users/:id/ratings
router.get("/users/:id/ratings", async (req: Request, res: Response) => {
  try {
    const ratings = await storage.getRatingsByUser(req.params.id);
    res.json(ratings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
