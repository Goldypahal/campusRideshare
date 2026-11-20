import { calculateTrustScore } from "./reputation.service";
import { resolveCoordinates, calculateRouteOverlap, haversineDistance } from "./geospatial.service";
import type { Ride, User } from "@shared/schema";

export interface MatchQueryParams {
  origin?: string;
  destination?: string;
  date?: string;
  time?: string;
  timeWindow?: number;
  genderPref?: string;
  yearPref?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

export interface MatchBreakdown {
  totalScore: number;
  routeScore: number;
  timeScore: number;
  trustScore: number;
  preferenceScore: number;
  spatialOverlapPct: number;
  detourKm: number;
  reasons: string[];
}

export interface SmartMatchResult {
  ride: Ride;
  driver: Omit<User, "password"> | null;
  matchScore: number;
  breakdown: MatchBreakdown;
}

const PYTHON_ML_URL = process.env.ML_SERVICE_URL || process.env.PYTHON_ML_SERVICE_URL || "http://127.0.0.1:8000";

/**
 * Calculates multi-factor spatial & temporal match score between a user query and a ride/driver
 */
export function calculateRideMatch(
  ride: Ride,
  driver: User | null,
  user: User | null,
  query: MatchQueryParams = {}
): MatchBreakdown {
  let routeScore = 0;
  let timeScore = 0;
  let preferenceScore = 0;
  const reasons: string[] = [];

  // 1. Geospatial Route & Overlap Calculation
  const userOriginStr = query.origin || user?.housingZone || "Main Gate";
  const userDestStr = query.destination || user?.homeAirport || "Chandigarh Railway Station";

  const passengerOriginCoords = resolveCoordinates(userOriginStr, query.originLat, query.originLng);
  const passengerDestCoords = resolveCoordinates(userDestStr, query.destLat, query.destLng);

  const driverOriginCoords = resolveCoordinates(ride.origin, ride.originLat, ride.originLng);
  const driverDestCoords = resolveCoordinates(ride.destination, ride.destLat, ride.destLng);

  const spatialMatch = calculateRouteOverlap(
    driverOriginCoords,
    driverDestCoords,
    passengerOriginCoords,
    passengerDestCoords
  );

  // Convert spatial overlap % to max 45 pts
  routeScore = Math.round((spatialMatch.overlapPercentage / 100) * 45);
  if (spatialMatch.overlapPercentage >= 80) {
    reasons.push(`High route overlap (${spatialMatch.overlapPercentage}%)`);
  } else if (spatialMatch.overlapPercentage >= 50) {
    reasons.push(`${spatialMatch.overlapPercentage}% route similarity`);
  }

  if (spatialMatch.detourKm <= 2.0) {
    reasons.push(`Minimal detour (${spatialMatch.detourKm} km)`);
  }

  // 2. Time Compatibility (max 25 pts)
  if (query.date && ride.date === query.date) {
    timeScore += 10;
    reasons.push("Exact date match");
  }

  if (query.time && ride.time) {
    const toMinutes = (t: string) => {
      const [hh, mm] = t.split(":").map(x => parseInt(x, 10) || 0);
      return hh * 60 + mm;
    };
    const queryMins = toMinutes(query.time);
    const rideMins = toMinutes(ride.time);
    const diffMins = Math.abs(queryMins - rideMins);
    const window = query.timeWindow || 30;

    if (diffMins <= window) {
      timeScore += 15;
      reasons.push(`Departure within ${diffMins} mins`);
    } else if (diffMins <= window * 2) {
      timeScore += 8;
      reasons.push(`Departure within ${diffMins} mins`);
    }
  } else {
    timeScore += 10;
  }

  // 3. Driver Trust Score (max 20 pts)
  let trustComponentScore = 0;
  if (driver) {
    const trustResult = calculateTrustScore({
      rating: driver.rating,
      totalRides: driver.totalRides,
      isVerified: driver.isVerified,
    });
    trustComponentScore = Math.round((trustResult.trustScore / 100) * 20);
    if (driver.isVerified) {
      reasons.push("Verified driver");
    }
    const driverRating = driver.rating ?? 0;
    if (driverRating >= 4.5) {
      reasons.push(`${driverRating}★ rated driver`);
    }
  }

  // 4. Preference Compatibility (max 10 pts)
  if (driver) {
    if (query.genderPref && query.genderPref !== "No preference") {
      if (driver.gender.toLowerCase() === query.genderPref.toLowerCase()) {
        preferenceScore += 5;
        reasons.push(`Matches gender preference (${driver.gender})`);
      }
    } else {
      preferenceScore += 5;
    }

    if (query.yearPref && query.yearPref !== "Any year") {
      if (driver.academicYear.toLowerCase() === query.yearPref.toLowerCase()) {
        preferenceScore += 5;
        reasons.push(`Matches academic year (${driver.academicYear})`);
      }
    } else {
      preferenceScore += 5;
    }
  }

  const totalScore = Math.min(
    Math.round(routeScore + timeScore + trustComponentScore + preferenceScore),
    100
  );

  return {
    totalScore,
    routeScore,
    timeScore,
    trustScore: trustComponentScore,
    preferenceScore,
    spatialOverlapPct: spatialMatch.overlapPercentage,
    detourKm: spatialMatch.detourKm,
    reasons,
  };
}

/**
 * Ranks candidate rides using Python ML service, falling back to V1 Rule-Based engine if ML service is unavailable.
 */
export async function rankCandidateRidesML(
  candidates: { ride: Ride; driver: User | null }[],
  query: MatchQueryParams = {}
): Promise<SmartMatchResult[]> {
  // First extract baseline features for all candidates
  const baselineResults = candidates.map(({ ride, driver }) => {
    const breakdown = calculateRideMatch(ride, driver, null, query);
    const driverWithoutPassword = driver
      ? (({ password, ...rest }) => rest)(driver)
      : null;

    return {
      ride,
      driver: driverWithoutPassword,
      matchScore: breakdown.totalScore,
      breakdown,
    };
  });

  // Attempt ML model ranker
  try {
    const payload = {
      candidates: baselineResults.map((item) => {
        const rideMins = item.ride.time
          ? parseInt(item.ride.time.split(":")[0]) * 60 + parseInt(item.ride.time.split(":")[1] || "0")
          : 0;
        const queryMins = query.time
          ? parseInt(query.time.split(":")[0]) * 60 + parseInt(query.time.split(":")[1] || "0")
          : 0;
        const departureDiff = Math.abs(queryMins - rideMins);

        return {
          ride_id: item.ride.id,
          route_overlap_pct: item.breakdown.spatialOverlapPct,
          departure_diff_mins: departureDiff,
          pickup_dev_km: item.breakdown.detourKm * 0.5,
          dest_dev_km: item.breakdown.detourKm * 0.5,
          driver_rating: item.driver?.rating || 4.0,
          driver_trust_score: item.driver?.trustScore || 85.0,
          cancellation_rate: 0.05,
          gender_pref_match: 1,
        };
      }),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${PYTHON_ML_URL}/predict/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const mlData = await res.json();
      const scoreMap = new Map<string, { score: number; reasons: string[] }>();
      for (const r of mlData.ranked_rides || []) {
        scoreMap.set(r.ride_id, { score: r.match_score, reasons: r.reasons });
      }

      for (const item of baselineResults) {
        const mlPrediction = scoreMap.get(item.ride.id);
        if (mlPrediction) {
          item.matchScore = mlPrediction.score;
          item.breakdown.totalScore = mlPrediction.score;
          if (mlPrediction.reasons && mlPrediction.reasons.length > 0) {
            item.breakdown.reasons = Array.from(
              new Set([...mlPrediction.reasons, ...item.breakdown.reasons])
            );
          }
        }
      }
    }
  } catch (err) {
    // Graceful fallback to V1 Rule-Based scoring
  }

  // Sort descending by match score
  return baselineResults.sort((a, b) => b.matchScore - a.matchScore);
}

