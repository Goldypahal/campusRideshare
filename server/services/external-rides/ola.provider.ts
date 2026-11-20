import { env } from "../../env";
import { EXTERNAL_PROVIDER_CONFIG } from "../../config/external-providers";
import type { ExternalRideProvider, HandoffRequest, ProviderCapabilities } from "./types";

export class OlaProvider implements ExternalRideProvider {
  public readonly id = "ola" as const;
  public readonly displayName = EXTERNAL_PROVIDER_CONFIG.ola.displayName;
  public readonly modes = EXTERNAL_PROVIDER_CONFIG.ola.modes;

  public readonly capabilities: ProviderCapabilities = {
    handoff: true,
    prefillsLocations: false,
    estimates: false,
    inAppBooking: false,
  };

  public isEnabled(): boolean {
    return env.EXTERNAL_RIDES_ENABLED && env.EXTERNAL_RIDES_OLA_ENABLED;
  }

  public buildHandoff(req: HandoffRequest): { url: string; prefilled: boolean } {
    const store = EXTERNAL_PROVIDER_CONFIG.ola.store;
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

export const olaProvider = new OlaProvider();
