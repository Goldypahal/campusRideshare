import { env } from "../../env";
import { EXTERNAL_PROVIDER_CONFIG } from "../../config/external-providers";
import type { ExternalRideProvider, HandoffRequest, ProviderCapabilities } from "./types";

export class UberProvider implements ExternalRideProvider {
  public readonly id = "uber" as const;
  public readonly displayName = EXTERNAL_PROVIDER_CONFIG.uber.displayName;
  public readonly modes = EXTERNAL_PROVIDER_CONFIG.uber.modes;

  public readonly capabilities: ProviderCapabilities = {
    handoff: true,
    prefillsLocations: true,
    estimates: false,
    inAppBooking: false,
  };

  public isEnabled(): boolean {
    const masterEnabled = env.EXTERNAL_RIDES_ENABLED;
    const providerEnabled = env.EXTERNAL_RIDES_UBER_ENABLED;
    const hasClientId = Boolean(env.UBER_CLIENT_ID && env.UBER_CLIENT_ID.trim().length > 0);
    return masterEnabled && providerEnabled && hasClientId;
  }

  public buildHandoff(req: HandoffRequest): { url: string; prefilled: boolean } {
    const clientId = env.UBER_CLIENT_ID ? env.UBER_CLIENT_ID.trim() : "";
    const url = new URL("https://m.uber.com/ul/");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("action", "setPickup");

    let hasPickupCoords = false;
    if (req.pickup.lat != null && req.pickup.lng != null) {
      hasPickupCoords = true;
      url.searchParams.set("pickup[latitude]", String(req.pickup.lat));
      url.searchParams.set("pickup[longitude]", String(req.pickup.lng));
      url.searchParams.set("pickup[nickname]", req.pickup.label);
      if (req.pickup.address) {
        url.searchParams.set("pickup[formatted_address]", req.pickup.address);
      }
    }

    let hasDropoffCoords = false;
    if (req.dropoff.lat != null && req.dropoff.lng != null) {
      hasDropoffCoords = true;
      url.searchParams.set("dropoff[latitude]", String(req.dropoff.lat));
      url.searchParams.set("dropoff[longitude]", String(req.dropoff.lng));
      url.searchParams.set("dropoff[nickname]", req.dropoff.label);
      if (req.dropoff.address) {
        url.searchParams.set("dropoff[formatted_address]", req.dropoff.address);
      }
    }

    // Do NOT send product_id in Stage 1 per requirements
    return {
      url: url.toString(),
      prefilled: hasPickupCoords || hasDropoffCoords,
    };
  }
}

export const uberProvider = new UberProvider();
