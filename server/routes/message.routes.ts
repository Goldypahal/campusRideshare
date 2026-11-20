import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertMessageSchema } from "@shared/schema";
import { authenticateToken, requireVerified, type AuthRequest } from "./auth.routes";
import { ValidationError, ForbiddenError } from "../errors";

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
    return res.status(429).json({
      type: "urn:problem:rate-limited",
      title: "Rate Limit Exceeded",
      status: 429,
      detail: "Message rate limit exceeded. Please wait a moment before sending more messages.",
      message: "Message rate limit exceeded. Please wait a moment before sending more messages.",
    });
  }

  record.count += 1;
  next();
}

// POST /api/messages (Requires institutional email verification)
router.post(
  "/",
  authenticateToken,
  requireVerified,
  messageRateLimiter,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const fromUserId = req.user!.id;
      const toUserId = messageData.toUserId;

      if (fromUserId === toUserId) {
        return next(new ValidationError("Cannot send a message to yourself"));
      }

      // Server-enforced conversation authorization
      const canChat = await storage.canUsersCommunicate(fromUserId, toUserId, messageData.rideId ?? undefined);
      if (!canChat) {
        return res.status(403).json({
          type: "urn:problem:forbidden",
          title: "Forbidden",
          status: 403,
          detail: "Not authorized to message this user. Messaging is only permitted between confirmed participants or pending requesters of a common ride.",
          message: "Not authorized to message this user. Messaging is only permitted between confirmed participants or pending requesters of a common ride.",
        });
      }

      const message = await storage.createMessage({
        ...messageData,
        fromUserId,
      });

      if ((req.app as any).sendToUser) {
        (req.app as any).sendToUser(toUserId, {
          type: "new_message",
          message,
        });
      }

      res.status(201).json(message);
    } catch (error: any) {
      next(error);
    }
  }
);

// GET /api/messages/:otherUserId
router.get("/:otherUserId", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const fromUserId = req.user!.id;
    const toUserId = req.params.otherUserId;
    const rideId = req.query.rideId as string | undefined;

    // Verify chat participants authorization
    const canChat = await storage.canUsersCommunicate(fromUserId, toUserId, rideId);
    if (!canChat) {
      return res.status(403).json({
        type: "urn:problem:forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Not authorized to access chat history for this user.",
        message: "Not authorized to access chat history for this user.",
      });
    }

    const limit = req.query.limit ? Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100) : 50;
    const offset = req.query.offset ? Math.max(parseInt(req.query.offset as string, 10) || 0, 0) : 0;
    const messages = await storage.getMessagesBetweenUsers(fromUserId, toUserId, offset, limit);
    res.json(messages);
  } catch (error: any) {
    next(error);
  }
});

export default router;
