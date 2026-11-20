import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertUserSchema, loginSchema, updateProfileSchema, updateUserRoleSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { emailService, generateVerificationToken, hashToken } from "../services/email.service";
import { ValidationError, UnauthorizedError, ForbiddenError, NotFoundError } from "../errors";
import { randomBytes } from "node:crypto";

const router = Router();
const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string; isVerified?: boolean };
}

// -------------------- Audit Log Store --------------------
export interface AuditLogEntry {
  id: string;
  action: string;
  targetUserId: string;
  performedBy: string;
  details: Record<string, any>;
  timestamp: Date;
}
export const roleAuditLogs: AuditLogEntry[] = [];

// -------------------- Rate Limiter --------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "global";
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 mins window
  const maxRequests = 25;

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + limitWindow });
    return next();
  }
  if (record.count >= maxRequests) {
    return res.status(429).json({
      type: "urn:problem:rate-limited",
      title: "Too Many Requests",
      status: 429,
      detail: "Too many authentication attempts. Please try again in 15 minutes.",
      message: "Too many authentication attempts. Please try again in 15 minutes.",
    });
  }
  record.count += 1;
  next();
};

// -------------------- JWT Middleware --------------------
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next(new UnauthorizedError("Access token required"));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role?: string };
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return next(new UnauthorizedError("Invalid token"));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role || decoded.role || "student",
      isVerified: user.isVerified || false,
    };
    next();
  } catch (error) {
    return res.status(403).json({
      type: "urn:problem:forbidden",
      title: "Forbidden",
      status: 403,
      detail: "Invalid or expired token",
      message: "Invalid or expired token",
    });
  }
};

// -------------------- Institutional Email Verification Middleware --------------------
export const requireVerified = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required"));
  }

  const user = await storage.getUser(req.user.id);
  if (!user || !user.isVerified) {
    return res.status(403).json({
      type: "urn:problem:forbidden",
      title: "Institutional Email Verification Required",
      status: 403,
      code: "EMAIL_VERIFICATION_REQUIRED",
      detail: "Institutional email verification required to perform this action. Please verify your email first.",
      message: "Institutional email verification required to perform this action. Please verify your email first.",
    });
  }
  next();
};

// -------------------- Role Authorization Middleware --------------------
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    const role = req.user.role || "student";
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        type: "urn:problem:forbidden",
        title: "Access Denied",
        status: 403,
        code: "FORBIDDEN_ROLE",
        detail: `Access denied: Requires one of [${allowedRoles.join(", ")}] roles. Current role: ${role}`,
        message: `Access denied: Requires one of [${allowedRoles.join(", ")}] roles. Current role: ${role}`,
      });
    }
    next();
  };
};

// POST /api/auth/register
router.post("/register", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = insertUserSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(400).json({
        type: "urn:problem:conflict",
        title: "Conflict",
        status: 400,
        detail: "User already exists with this email",
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    // Role is strictly forced to "student" on public registration (Finding 1)
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword,
    });

    // Generate cryptographically secure token with 30-min TTL and SHA-256 hash (Finding 2)
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    await storage.createVerificationToken({
      userId: user.id,
      token: tokenHash,
      type: "email_verification",
      expiresAt,
    });

    // Dispatch verification token via email provider (never in JSON body!)
    await emailService.sendVerificationEmail(user.email, rawToken);

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: "student" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      user: { ...user, role: "student", password: undefined },
      token: jwtToken,
      verification: {
        sent: true,
        expiresAt,
        message: "Account registered. Verification link has been dispatched to your institutional email.",
      },
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return next(new ValidationError("Verification token is required"));
    }

    // Lookup token by its SHA-256 hash or raw token (for backwards compatibility)
    const hashed = hashToken(token);
    let record = await storage.getVerificationToken(hashed);
    if (!record) {
      record = await storage.getVerificationToken(token);
    }

    if (!record) {
      return res.status(400).json({
        type: "urn:problem:validation-error",
        title: "Invalid Token",
        status: 400,
        detail: "Invalid verification token",
        message: "Invalid verification token",
      });
    }

    if (record.usedAt) {
      return res.status(400).json({
        type: "urn:problem:conflict",
        title: "Token Already Used",
        status: 400,
        detail: "This verification token has already been used",
        message: "This verification token has already been used",
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({
        type: "urn:problem:validation-error",
        title: "Token Expired",
        status: 400,
        detail: "Verification token has expired. Please request a new one.",
        message: "Verification token has expired. Please request a new one.",
      });
    }

    // Mark token used and user verified
    await storage.markTokenUsed(record.id);
    const updatedUser = await storage.updateUser(record.userId, { isVerified: true });

    res.json({
      success: true,
      message: "University email successfully verified!",
      user: updatedUser ? { ...updatedUser, password: undefined } : null,
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ValidationError("Email is required"));

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Prevent user enumeration
      return res.json({ success: true, message: "If an account exists, a verification link has been dispatched." });
    }

    if (user.isVerified) {
      return res.status(400).json({
        type: "urn:problem:validation-error",
        title: "Already Verified",
        status: 400,
        detail: "Account is already verified",
        message: "Account is already verified",
      });
    }

    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();

    await storage.createVerificationToken({
      userId: user.id,
      token: tokenHash,
      type: "email_verification",
      expiresAt,
    });

    await emailService.sendVerificationEmail(user.email, rawToken);

    res.json({
      success: true,
      message: "A new verification link has been dispatched to your institutional email.",
    });
  } catch (error: any) {
    next(error);
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        type: "urn:problem:validation-error",
        title: "Invalid Credentials",
        status: 400,
        detail: "Invalid email or password",
        message: "Invalid email or password",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({
        type: "urn:problem:validation-error",
        title: "Invalid Credentials",
        status: 400,
        detail: "Invalid email or password",
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "student" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      user: { ...user, password: undefined },
      token,
    });
  } catch (error: any) {
    next(error);
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return next(new NotFoundError("User not found"));

    res.json({ ...user, password: undefined });
  } catch (error: any) {
    next(error);
  }
});

// PUT & PATCH /api/auth/profile and /api/users/me
async function handleProfileUpdate(req: AuthRequest, res: Response, next: NextFunction) {
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
  } catch (error: any) {
    next(error);
  }
}

router.put("/profile", authenticateToken, handleProfileUpdate);
router.put("/me", authenticateToken, handleProfileUpdate);
router.patch("/me", authenticateToken, handleProfileUpdate);

// POST /api/auth/ws-ticket (Ticket-based WebSocket Authentication)
const wsTickets = new Map<string, { userId: string; expiresAt: number }>();
export function validateWsTicket(ticket: string): string | null {
  const record = wsTickets.get(ticket);
  if (!record) return null;
  wsTickets.delete(ticket); // Single use
  if (Date.now() > record.expiresAt) return null;
  return record.userId;
}

router.post("/ws-ticket", authenticateToken, (req: AuthRequest, res: Response) => {
  const ticket = randomBytes(24).toString("hex");
  // 30 seconds ticket validity
  wsTickets.set(ticket, {
    userId: req.user!.id,
    expiresAt: Date.now() + 30 * 1000,
  });
  res.json({ ticket, expiresInSeconds: 30 });
});

export default router;
