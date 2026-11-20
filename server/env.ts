import { z } from "zod";

const booleanFlag = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
    return defaultValue;
  }, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  DATABASE_URL: z.string().optional(),
  // External Ride-Hailing Fallback Configuration
  EXTERNAL_RIDES_ENABLED: booleanFlag(true),
  EXTERNAL_RIDES_UBER_ENABLED: booleanFlag(true),
  EXTERNAL_RIDES_OLA_ENABLED: booleanFlag(false),
  EXTERNAL_RIDES_RAPIDO_ENABLED: booleanFlag(false),
  UBER_CLIENT_ID: z.string().default(""),
  EXTERNAL_RIDES_MATCH_THRESHOLD: z.coerce.number().default(60),
  EXTERNAL_RIDES_SOON_MINUTES: z.coerce.number().default(45),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.warn("⚠️ Environment variables validation notice:", result.error.format());
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration in production. Missing required variables.");
    }
  }

  const parsed = result.success ? result.data : {
    NODE_ENV: ((process.env.NODE_ENV as any) || "development") as "development" | "production" | "test",
    PORT: process.env.PORT || "5000",
    JWT_SECRET: process.env.JWT_SECRET || "dev-fallback-secret-key-campus-rideshare",
    DATABASE_URL: process.env.DATABASE_URL,
    EXTERNAL_RIDES_ENABLED: process.env.EXTERNAL_RIDES_ENABLED !== "false",
    EXTERNAL_RIDES_UBER_ENABLED: process.env.EXTERNAL_RIDES_UBER_ENABLED !== "false",
    EXTERNAL_RIDES_OLA_ENABLED: process.env.EXTERNAL_RIDES_OLA_ENABLED === "true",
    EXTERNAL_RIDES_RAPIDO_ENABLED: process.env.EXTERNAL_RIDES_RAPIDO_ENABLED === "true",
    UBER_CLIENT_ID: process.env.UBER_CLIENT_ID || "",
    EXTERNAL_RIDES_MATCH_THRESHOLD: Number(process.env.EXTERNAL_RIDES_MATCH_THRESHOLD) || 60,
    EXTERNAL_RIDES_SOON_MINUTES: Number(process.env.EXTERNAL_RIDES_SOON_MINUTES) || 45,
  };

  if (parsed.NODE_ENV === "production") {
    if (!parsed.DATABASE_URL) {
      throw new Error("DATABASE_URL is required in production environment. MemStorage fallback is disabled in production.");
    }
    const insecureSecrets = new Set([
      "dev-fallback-secret-key-campus-rideshare",
      "production_secure_jwt_secret_change_in_env",
      "secret",
      "jwt_secret",
      "changeme",
    ]);
    if (
      !parsed.JWT_SECRET ||
      parsed.JWT_SECRET.length < 32 ||
      insecureSecrets.has(parsed.JWT_SECRET)
    ) {
      throw new Error(
        "A strong, unique JWT_SECRET (at least 32 characters, non-default) is strictly required in production."
      );
    }
  }

  return parsed;
}

export const env = validateEnv();
