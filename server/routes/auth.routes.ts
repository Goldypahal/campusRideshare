import { Router, type Request, type Response, type NextFunction } from "express";
import { storage } from "../storage";
import { insertUserSchema, loginSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";

const router = Router();
const JWT_SECRET = env.JWT_SECRET;

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

// -------------------- Rate Limiter --------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
export const authRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "global";
  const now = Date.now();
  const limitWindow = 15 * 60 * 1000; // 15 mins window
  const maxRequests = 20;

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + limitWindow });
    return next();
  }
  if (record.count >= maxRequests) {
    return res.status(429).json({ message: "Too many authentication requests. Please try again later." });
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
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await storage.getUser(decoded.id);
    if (!user) return res.status(401).json({ message: "Invalid token" });

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
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

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      user: { ...user, password: undefined },
      token,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

// POST /api/auth/login
router.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

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
