import { calculateTrustScore } from "./reputation.service";
import type { Ride, User } from "@shared/schema";

export interface MatchQueryParams {
  origin?: string;
  destination?: string;
  date?: string;
  time?: string;
  timeWindow?: number;
  genderPref?: string;
  yearPref?: string;
}

export interface MatchBreakdown {
  totalScore: number;
  routeScore: number;
  timeScore: number;
  trustScore: number;
  preferenceScore: number;
  reasons: string[];
}

export interface SmartMatchResult {
  ride: Ride;
  driver: Omit<User, "password"> | null;
  matchScore: number;
  breakdown: MatchBreakdown;
}

/**
 * Calculates multi-factor match score between a user/query and a ride/driver
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

  const rideOrigin = ride.origin.toLowerCase();
  const rideDest = ride.destination.toLowerCase();

  // 1. Route & Geographic Overlap (max 40 pts)
  const searchOrigin = query.origin?.toLowerCase();
  const searchDest = query.destination?.toLowerCase();

  if (searchOrigin && rideOrigin.includes(searchOrigin)) {
    routeScore += 20;
    reasons.push(`Origin matches "${query.origin}"`);
  }
  if (searchDest && rideDest.includes(searchDest)) {
    routeScore += 20;
    reasons.push(`Destination matches "${query.destination}"`);
  }

  // Fallback to user homeAirport / housingZone if search parameters omitted
  if (!searchOrigin && !searchDest && user) {
    if (user.homeAirport && (rideOrigin.includes(user.homeAirport.toLowerCase()) || rideDest.includes(user.homeAirport.toLowerCase()))) {
      routeScore += 20;
      reasons.push(`Matches home airport (${user.homeAirport})`);
    }
    if (user.housingZone && (rideOrigin.includes(user.housingZone.toLowerCase()) || rideDest.includes(user.housingZone.toLowerCase()))) {
      routeScore += 20;
      reasons.push(`Matches housing zone (${user.housingZone})`);
    }
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

  // 4. Preference Compatibility (max 15 pts)
  if (driver) {
    if (query.genderPref && query.genderPref !== "No preference") {
      if (driver.gender.toLowerCase() === query.genderPref.toLowerCase()) {
        preferenceScore += 7.5;
        reasons.push(`Matches gender preference (${driver.gender})`);
      }
    } else {
      preferenceScore += 7.5;
    }

    if (query.yearPref && query.yearPref !== "Any year") {
      if (driver.academicYear.toLowerCase() === query.yearPref.toLowerCase()) {
        preferenceScore += 7.5;
        reasons.push(`Matches academic year (${driver.academicYear})`);
      }
    } else {
      preferenceScore += 7.5;
    }
  }

  const totalScore = Math.min(Math.round(routeScore + timeScore + trustComponentScore + preferenceScore), 100);

  return {
    totalScore,
    routeScore,
    timeScore,
    trustScore: trustComponentScore,
    preferenceScore,
    reasons,
  };
}
