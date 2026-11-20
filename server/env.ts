import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("5000"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  DATABASE_URL: z.string().optional(),
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

  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
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
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32 ||
      insecureSecrets.has(process.env.JWT_SECRET)
    ) {
      throw new Error(
        "A strong, unique JWT_SECRET (at least 32 characters, non-default) is strictly required in production."
      );
    }
  }

  return {
    NODE_ENV: (process.env.NODE_ENV as any) || "development",
    PORT: process.env.PORT || "5000",
    JWT_SECRET: process.env.JWT_SECRET || "dev-fallback-secret-key-campus-rideshare",
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

export const env = validateEnv();
