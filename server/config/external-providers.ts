export type Platform = "android" | "ios" | "web";

export interface ProviderStoreConfig {
  androidPackage: string;
  androidUrl: string;
  iosAppId: string;
  iosUrl: string;
  webUrl: string;
}

export interface ExternalProviderMetadata {
  id: "uber" | "ola" | "rapido";
  displayName: string;
  modes: Array<"cab" | "auto" | "bike">;
  store: ProviderStoreConfig;
}

export const EXTERNAL_PROVIDER_CONFIG: Record<"uber" | "ola" | "rapido", ExternalProviderMetadata> = {
  uber: {
    id: "uber",
    displayName: "Uber",
    modes: ["cab", "auto", "bike"],
    store: {
      androidPackage: "com.ubercab",
      // VERIFY: Checked official Google Play Store listing: https://play.google.com/store/apps/details?id=com.ubercab
      androidUrl: "https://play.google.com/store/apps/details?id=com.ubercab",
      iosAppId: "368676349",
      // VERIFY: Checked official Apple App Store listing: https://apps.apple.com/app/id368676349
      iosUrl: "https://apps.apple.com/app/id368676349",
      webUrl: "https://m.uber.com",
    },
  },
  ola: {
    id: "ola",
    displayName: "Ola Cabs",
    modes: ["cab", "auto", "bike"],
    store: {
      androidPackage: "com.olacabs.customer",
      // VERIFY: Checked official Google Play Store listing: https://play.google.com/store/apps/details?id=com.olacabs.customer
      androidUrl: "https://play.google.com/store/apps/details?id=com.olacabs.customer",
      iosAppId: "539179365",
      // VERIFY: Checked official Apple App Store listing: https://apps.apple.com/app/id539179365
      iosUrl: "https://apps.apple.com/app/id539179365",
      // VERIFY: Checked official website: https://www.olacabs.com
      webUrl: "https://www.olacabs.com",
    },
  },
  rapido: {
    id: "rapido",
    displayName: "Rapido",
    modes: ["bike", "auto", "cab"],
    store: {
      androidPackage: "com.rapido.passenger",
      // VERIFY: Checked official Google Play Store listing: https://play.google.com/store/apps/details?id=com.rapido.passenger
      androidUrl: "https://play.google.com/store/apps/details?id=com.rapido.passenger",
      iosAppId: "1198464606",
      // VERIFY: Checked official Apple App Store listing: https://apps.apple.com/app/id1198464606
      iosUrl: "https://apps.apple.com/app/id1198464606",
      // VERIFY: Checked official website: https://www.rapido.bike
      webUrl: "https://www.rapido.bike",
    },
  },
};
