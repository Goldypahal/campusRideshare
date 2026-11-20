import { env } from "../../env";
import { EXTERNAL_PROVIDER_CONFIG } from "../../config/external-providers";
import type { ExternalRideProvider, HandoffRequest, ProviderCapabilities } from "./types";

export class RapidoProvider implements ExternalRideProvider {
  public readonly id = "rapido" as const;
  public readonly displayName = EXTERNAL_PROVIDER_CONFIG.rapido.displayName;
  public readonly modes = EXTERNAL_PROVIDER_CONFIG.rapido.modes;

  public readonly capabilities: ProviderCapabilities = {
    handoff: true,
    prefillsLocations: false,
    estimates: false,
    inAppBooking: false,
  };

  public isEnabled(): boolean {
    return env.EXTERNAL_RIDES_ENABLED && env.EXTERNAL_RIDES_RAPIDO_ENABLED;
  }

  public buildHandoff(req: HandoffRequest): { url: string; prefilled: boolean } {
    const store = EXTERNAL_PROVIDER_CONFIG.rapido.store;
    let targetUrl: string;

    if (req.platform === "android") {
      targetUrl = store.androidUrl;
    } else if (req.platform === "ios") {
      targetUrl = store.iosUrl;
    } else {
      targetUrl = store.webUrl;
    }

    return {
      url: targetUrl,
      prefilled: false,
    };
  }
}

export const rapidoProvider = new RapidoProvider();
