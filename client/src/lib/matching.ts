export interface MatchingCriteria {
  gender?: string;
  academicYear?: string;
  verifiedOnly?: boolean;
}

export interface RideWithDriver {
  id: string;
  origin: string;
  destination: string;
  date: string;
  time: string;
  availableSeats: number;
  costPerPerson: number;
  vehicle?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  driver: {
    id: string;
    fullName: string;
    academicYear: string;
    gender: string;
    major: string;
    isVerified: boolean;
    rating: number;
    totalRides: number;
  };
}

export const calculateMatchPercentage = (
  ride: RideWithDriver,
  criteria: MatchingCriteria,
  searchOrigin?: string,
  searchDestination?: string
): number => {
  let score = 0;
  let totalFactors = 0;

  // Location matching (40% weight)
  if (searchOrigin || searchDestination) {
    let locScore = 0;
    if (searchOrigin && ride.origin.toLowerCase().includes(searchOrigin.toLowerCase())) {
      locScore += 20;
    }
    if (searchDestination && ride.destination.toLowerCase().includes(searchDestination.toLowerCase())) {
      locScore += 20;
    }
    score += locScore;
    totalFactors += 40;
  }

  // Gender preference (20% weight)
  if (criteria.gender && criteria.gender !== 'No preference') {
    const genderMatch = ride.driver.gender === criteria.gender ? 20 : 0;
    score += genderMatch;
    totalFactors += 20;
  }

  // Academic year preference (15% weight)
  if (criteria.academicYear && criteria.academicYear !== 'Any year') {
    const yearMatch = ride.driver.academicYear === criteria.academicYear ? 15 : 0;
    score += yearMatch;
    totalFactors += 15;
  }

  // Verification status (15% weight)
  if (criteria.verifiedOnly) {
    const verifiedMatch = ride.driver.isVerified ? 15 : 0;
    score += verifiedMatch;
    totalFactors += 15;
  }

  // Driver rating & reliability (10% weight)
  const ratingScore = Math.min(((ride.driver.rating || 5) / 5) * 10, 10);
  score += ratingScore;
  totalFactors += 10;

  // If no search filter factors were supplied, calculate deterministic score based on rating & seats
  if (totalFactors === 0 || score === 0) {
    const baseRatingScore = Math.min(((ride.driver.rating || 4.5) / 5) * 85, 85);
    const recurringBonus = ride.isRecurring ? 10 : 0;
    const seatBonus = Math.min(ride.availableSeats * 2.5, 5);
    return Math.min(Math.round(baseRatingScore + recurringBonus + seatBonus), 100);
  }

  return Math.min(Math.round(score), 100);
};

export const filterAndSortRides = (
  rides: RideWithDriver[],
  criteria: MatchingCriteria,
  searchOrigin?: string,
  searchDestination?: string
): (RideWithDriver & { matchPercentage: number })[] => {
  return rides
    .filter(ride => {
      if (criteria.verifiedOnly && ride.driver && !ride.driver.isVerified) {
        return false;
      }
      
      if (criteria.gender && criteria.gender !== 'No preference' && ride.driver && ride.driver.gender !== criteria.gender) {
        return false;
      }
      
      if (criteria.academicYear && criteria.academicYear !== 'Any year' && ride.driver && ride.driver.academicYear !== criteria.academicYear) {
        return false;
      }

      return true;
    })
    .map(ride => ({
      ...ride,
      matchPercentage: calculateMatchPercentage(ride, criteria, searchOrigin, searchDestination)
    }))
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
};
