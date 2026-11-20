import { z } from "zod";

export type ProviderId = "uber" | "ola" | "rapido";

export interface ExternalPlace {
  label: string;               // e.g. "Hostel B" — shown to the user
  address?: string;            // formatted address, if known
  lat?: number;                // only if VERIFIED
  lng?: number;
}

export interface HandoffRequest {
  pickup: ExternalPlace;
  dropoff: ExternalPlace;
  platform: "android" | "ios" | "web";
  context?: {
    reason: "no_match" | "low_match" | "too_soon" | "manual";
    searchId?: string;
  };
}

export interface ProviderCapabilities {
  handoff: true;               // Stage 1
  prefillsLocations: boolean;  // true for Uber, false for Ola/Rapido in Stage 1
  estimates: boolean;          // Stage 2 — false for now
  inAppBooking: boolean;       // Stage 2 — false for now
}

export interface ExternalRideProvider {
  id: ProviderId;
  displayName: string;
  modes: Array<"cab" | "auto" | "bike">;
  capabilities: ProviderCapabilities;
  isEnabled(): boolean;                       // flag + required config present
  buildHandoff(req: HandoffRequest): { url: string; prefilled: boolean };
  // Stage 2 extension points — declare, do not implement:
  getEstimates?(req: HandoffRequest): Promise<never>;
  book?(req: HandoffRequest): Promise<never>;
}

// Zod Validation Schemas
export const externalPlaceSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Location label must not be empty")
    .max(120, "Location label must be 120 characters or less"),
  address: z.string().trim().max(250).optional(),
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
});

export const handoffRequestSchema = z.object({
  providerId: z.enum(["uber", "ola", "rapido"]),
  pickup: externalPlaceSchema,
  dropoff: externalPlaceSchema,
  platform: z.enum(["android", "ios", "web"]).default("web"),
  context: z
    .object({
      reason: z.enum(["no_match", "low_match", "too_soon", "manual"]),
      searchId: z.string().optional(),
    })
    .optional(),
});

export type ValidatedHandoffBody = z.infer<typeof handoffRequestSchema>;
