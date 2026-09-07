import { Router, type Response } from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";

const router = Router();

// POST /api/messages
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const messageData = insertMessageSchema.parse(req.body);
    const message = await storage.createMessage({ ...messageData, fromUserId: req.user!.id });
    
    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(messageData.toUserId, { type: "new_message", message });
    }
    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/messages/:userId
router.get("/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || "100", 10);
    const offset = parseInt(req.query.offset as string || "0", 10);
    const messages = await storage.getMessagesBetweenUsers(req.user!.id, req.params.userId, offset, limit);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
