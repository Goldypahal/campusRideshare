import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { authenticateToken, type AuthRequest } from "./auth.routes";

const router = Router();

// In-memory rate limiter for messages: max 30 messages per 60 seconds per user
const messageRateMap = new Map<string, { count: number; resetTime: number }>();
function messageRateLimiter(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return next();

  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxMsgs = 30;

  const record = messageRateMap.get(userId);
  if (!record || now > record.resetTime) {
    messageRateMap.set(userId, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxMsgs) {
    return res.status(429).json({ message: "Message rate limit exceeded. Please wait a moment before sending more messages." });
  }

  record.count += 1;
  next();
}

// POST /api/messages
router.post("/", authenticateToken, messageRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const messageData = insertMessageSchema.parse(req.body);
    const fromUserId = req.user!.id;
    const toUserId = messageData.toUserId;

    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Cannot send a message to yourself" });
    }

    // Server-enforced conversation authorization
    const canChat = await storage.canUsersCommunicate(fromUserId, toUserId, messageData.rideId ?? undefined);
    if (!canChat) {
      return res.status(403).json({
        message: "Not authorized to message this user. Messaging is only permitted between confirmed participants or pending requesters of a common ride.",
      });
    }

    const message = await storage.createMessage({
      ...messageData,
      fromUserId,
      content: messageData.content.trim(),
    });

    // Targeted WebSocket delivery
    if ((req.app as any).sendToUser) {
      (req.app as any).sendToUser(toUserId, { type: "new_message", message });
    }

    res.status(201).json(message);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// GET /api/messages/:userId
router.get("/:userId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const fromUserId = req.user!.id;
    const targetUserId = req.params.userId;
    const rideId = req.query.rideId as string | undefined;

    // Server-enforced conversation authorization for history access
    const canView = await storage.canUsersCommunicate(fromUserId, targetUserId, rideId);
    if (!canView) {
      return res.status(403).json({
        message: "Not authorized to view messages with this user without a mutual ride or booking.",
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string || "100", 10), 100);
    const offset = Math.max(parseInt(req.query.offset as string || "0", 10), 0);

    const messages = await storage.getMessagesBetweenUsers(fromUserId, targetUserId, offset, limit);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
