import { Router, type Response } from "express";
import { storage } from "../storage";
import { authenticateToken, type AuthRequest } from "./auth.routes";

const router = Router();

// POST /api/sos
router.post("/sos", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { latitude, longitude, message } = req.body;
    const user = await storage.getUser(req.user!.id);
    const sos = {
      id: Date.now().toString(),
      userId: req.user!.id,
      userName: user?.fullName || user?.email,
      latitude: latitude || null,
      longitude: longitude || null,
      message: message || "EMERGENCY SOS ALERT",
      createdAt: new Date().toISOString(),
    };

    if ((req.app as any).broadcastWS) {
      (req.app as any).broadcastWS({ type: "sos", sos });
    }
    res.json({ ok: true, sos });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
