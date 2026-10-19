import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertUserSchema, loginSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { randomBytes } from "crypto";

const router = Router();
const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role?: string };
}

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
    return res.status(429).json({ message: "Too many authentication attempts. Please try again in 15 minutes." });
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

  if (!token) return res.status(401).json({ message: "Access token required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role?: string };
    const user = await storage.getUser(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    req.user = { id: user.id, email: user.email, role: user.role || decoded.role || "student" };
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// -------------------- Role Authorization Middleware --------------------
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const role = req.user.role || "student";
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message: `Access denied: Requires one of [${allowedRoles.join(", ")}] roles. Current role: ${role}`,
      });
    }
    next();
  };
};

// POST /api/auth/register
router.post("/register", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const userData = insertUserSchema.parse(req.body);

    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = await storage.createUser({ ...userData, password: hashedPassword });

    // Generate expiring single-use verification token (24-hour validity)
    const verificationHex = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const verificationToken = await storage.createVerificationToken({
      userId: user.id,
      token: verificationHex,
      type: "email_verification",
      expiresAt,
    });

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role || "student" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      user: { ...user, password: undefined },
      token: jwtToken,
      verification: {
        token: verificationToken.token,
        expiresAt: verificationToken.expiresAt,
        message: "Account registered. Please verify your email using the verification token.",
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const record = await storage.getVerificationToken(token);
    if (!record) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    if (record.usedAt) {
      return res.status(400).json({ message: "This verification token has already been used" });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ message: "Verification token has expired. Please request a new one." });
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
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await storage.getUserByEmail(email);
    if (!user) {
      // Avoid user enumeration
      return res.json({ message: "If an account exists, a verification link has been generated." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account is already verified" });
    }

    const verificationHex = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const token = await storage.createVerificationToken({
      userId: user.id,
      token: verificationHex,
      type: "email_verification",
      expiresAt,
    });

    res.json({
      success: true,
      token: token.token,
      message: "A new verification token has been generated.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
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
    res.status(400).json({ message: error.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ ...user, password: undefined });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/auth/profile
router.put("/profile", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, academicYear, major, gender, homeAirport, housingZone } = req.body;
    const updatedUser = await storage.updateUser(req.user!.id, {
      fullName,
      academicYear,
      major,
      gender,
      homeAirport: homeAirport ?? null,
      housingZone: housingZone ?? null,
    });

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    res.json({ ...updatedUser, password: undefined });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
