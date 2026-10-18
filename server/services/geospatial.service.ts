export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteOverlapResult {
  overlapPercentage: number;
  pickupDeviationKm: number;
  destDeviationKm: number;
  detourKm: number;
  estimatedTravelMins: number;
}

// Landmark registry for campus & metropolitan travel hubs
export const CAMPUS_LANDMARKS: Record<string, Coordinates> = {
  "hostel a": { lat: 30.758, lng: 76.768 },
  "hostel b": { lat: 30.76, lng: 76.77 },
  "hostel c": { lat: 30.762, lng: 76.769 },
  "academic block 1": { lat: 30.755, lng: 76.766 },
  "academic block 2": { lat: 30.757, lng: 76.767 },
  "main gate": { lat: 30.751, lng: 76.762 },
  "library": { lat: 30.756, lng: 76.765 },
  "sector 17": { lat: 30.7398, lng: 76.7827 },
  "sector 17 bus stand": { lat: 30.7398, lng: 76.7827 },
  "chandigarh railway station": { lat: 30.7046, lng: 76.8242 },
  "railway station": { lat: 30.7046, lng: 76.8242 },
  "airport": { lat: 30.6735, lng: 76.7885 },
  "ixc airport": { lat: 30.6735, lng: 76.7885 },
  "housing zone north": { lat: 30.765, lng: 76.772 },
  "housing zone south": { lat: 30.748, lng: 76.758 },
};

/**
 * Calculates Haversine distance in kilometers between two coordinates
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Resolves a location string to coordinates using landmark dictionary or fallback heuristic
 */
export function resolveCoordinates(
  locationStr: string,
  providedLat?: number | null,
  providedLng?: number | null
): Coordinates {
  if (providedLat != null && providedLng != null) {
    return { lat: providedLat, lng: providedLng };
  }

  const normalized = locationStr.toLowerCase().trim();
  for (const [key, coords] of Object.entries(CAMPUS_LANDMARKS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return coords;
    }
  }

  // Default campus center fallback with slight deterministic hash offset
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
  }
  const offsetLat = ((Math.abs(hash) % 100) - 50) * 0.0005;
  const offsetLng = ((Math.abs(hash >> 2) % 100) - 50) * 0.0005;

  return {
    lat: 30.755 + offsetLat,
    lng: 76.765 + offsetLng,
  };
}

/**
 * Calculates route overlap percentage, pickup/destination deviation, and detour km
 */
export function calculateRouteOverlap(
  driverOrigin: Coordinates,
  driverDest: Coordinates,
  passengerOrigin: Coordinates,
  passengerDest: Coordinates
): RouteOverlapResult {
  const driverTotalDist = haversineDistance(
    driverOrigin.lat,
    driverOrigin.lng,
    driverDest.lat,
    driverDest.lng
  );

  const passengerTotalDist = haversineDistance(
    passengerOrigin.lat,
    passengerOrigin.lng,
    passengerDest.lat,
    passengerDest.lng
  );

  const pickupDev = haversineDistance(
    driverOrigin.lat,
    driverOrigin.lng,
    passengerOrigin.lat,
    passengerOrigin.lng
  );

  const destDev = haversineDistance(
    driverDest.lat,
    driverDest.lng,
    passengerDest.lat,
    passengerDest.lng
  );

  // Combined detour distance if driver picks up passenger then drops off passenger
  const sharedLegDist = haversineDistance(
    passengerOrigin.lat,
    passengerOrigin.lng,
    passengerDest.lat,
    passengerDest.lng
  );

  const detourKm = Math.round((pickupDev + destDev) * 100) / 100;

  // Compute route overlap percentage (0% to 100%)
  const maxPossibleDist = Math.max(driverTotalDist, passengerTotalDist, 0.1);
  const PenaltyFactor = pickupDev * 0.15 + destDev * 0.15;
  const rawOverlap = Math.max(0, 1 - PenaltyFactor / maxPossibleDist);
  const overlapPercentage = Math.min(100, Math.round(rawOverlap * 100));

  // Estimate travel duration based on average city speed (30 km/h -> 0.5 km/min)
  const estimatedTravelMins = Math.max(5, Math.round((driverTotalDist / 30) * 60));

  return {
    overlapPercentage,
    pickupDeviationKm: pickupDev,
    destDeviationKm: destDev,
    detourKm,
    estimatedTravelMins,
  };
}
