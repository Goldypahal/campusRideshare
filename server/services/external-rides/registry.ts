import type { ExternalRideProvider, ProviderId } from "./types";
import { uberProvider } from "./uber.provider";
import { olaProvider } from "./ola.provider";
import { rapidoProvider } from "./rapido.provider";

export const ALL_PROVIDERS: Record<ProviderId, ExternalRideProvider> = {
  uber: uberProvider,
  ola: olaProvider,
  rapido: rapidoProvider,
};

export function getProvider(id: ProviderId): ExternalRideProvider | undefined {
  return ALL_PROVIDERS[id];
}

export function getEnabledProviders(): ExternalRideProvider[] {
  return Object.values(ALL_PROVIDERS).filter((p) => p.isEnabled());
}
