import { Router, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { updateUserRoleSchema } from "@shared/schema";
import { authenticateToken, requireRole, type AuthRequest, roleAuditLogs } from "./auth.routes";
import { ValidationError, NotFoundError } from "../errors";
import { randomUUID } from "node:crypto";

const router = Router();

// POST /api/admin/users/:id/roles (Audited Role Assignment)
router.post(
  "/users/:id/roles",
  authenticateToken,
  requireRole(["admin"]),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const targetUserId = req.params.id;
      const { role, reason } = updateUserRoleSchema.parse(req.body);

      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return next(new NotFoundError("Target user not found"));
      }

      const previousRole = targetUser.role || "student";
      const updatedUser = await storage.updateUser(targetUserId, { role });

      // Append to immutable audit log
      const auditEntry = {
        id: randomUUID(),
        action: "ROLE_CHANGE",
        targetUserId,
        performedBy: req.user!.id,
        details: {
          previousRole,
          newRole: role,
          reason,
        },
        timestamp: new Date(),
      };
      roleAuditLogs.push(auditEntry);

      console.log(
        `🛡️ [AUDIT] Role changed for user ${targetUserId}: ${previousRole} -> ${role} by admin ${req.user!.id}. Reason: "${reason}"`
      );

      res.json({
        success: true,
        message: `Role successfully updated to ${role}`,
        user: updatedUser ? { ...updatedUser, password: undefined } : null,
        auditLogId: auditEntry.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/audit-logs (View Audit Trail)
router.get(
  "/audit-logs",
  authenticateToken,
  requireRole(["admin"]),
  (_req: AuthRequest, res: Response) => {
    res.json({ auditLogs: roleAuditLogs });
  }
);

export default router;
