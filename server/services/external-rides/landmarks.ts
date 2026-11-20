import { CAMPUS_LANDMARKS, type Coordinates } from "../geospatial.service";

/**
 * Performs an exact (case-insensitive, trimmed) lookup of a campus landmark.
 * Returns verified coordinates if an exact match exists in the registry.
 * Returns undefined for partial, ambiguous, or unlisted locations.
 * Never calls resolveCoordinates() or invents coordinates.
 */
export function lookupKnownPlace(label: string): Coordinates | undefined {
  if (!label || typeof label !== "string") {
    return undefined;
  }
  const normalized = label.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(CAMPUS_LANDMARKS, normalized)) {
    return CAMPUS_LANDMARKS[normalized];
  }
  return undefined;
}
