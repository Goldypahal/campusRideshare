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
  if (searchOrigin && searchDestination) {
    const originMatch = ride.origin.toLowerCase().includes(searchOrigin.toLowerCase()) ? 1 : 0;
    const destMatch = ride.destination.toLowerCase().includes(searchDestination.toLowerCase()) ? 1 : 0;
    score += (originMatch + destMatch) * 20;
    totalFactors += 40;
  }

  // Gender preference (20% weight)
  if (criteria.gender && criteria.gender !== 'No preference') {
    const genderMatch = ride.driver.gender === criteria.gender ? 1 : 0;
    score += genderMatch * 20;
    totalFactors += 20;
  }

  // Academic year preference (15% weight)
  if (criteria.academicYear && criteria.academicYear !== 'Any year') {
    const yearMatch = ride.driver.academicYear === criteria.academicYear ? 1 : 0;
    score += yearMatch * 15;
    totalFactors += 15;
  }

  // Verification status (15% weight)
  if (criteria.verifiedOnly) {
    const verifiedMatch = ride.driver.isVerified ? 1 : 0;
    score += verifiedMatch * 15;
    totalFactors += 15;
  }

  // Driver rating (10% weight)
  const ratingScore = (ride.driver.rating / 5) * 10;
  score += ratingScore;
  totalFactors += 10;

  // If no criteria specified, return base score
  if (totalFactors === 0) {
    return Math.min(85 + Math.random() * 15, 100); // Random between 85-100%
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
      // Apply filters
      if (criteria.verifiedOnly && !ride.driver.isVerified) {
        return false;
      }
      
      if (criteria.gender && criteria.gender !== 'No preference' && ride.driver.gender !== criteria.gender) {
        return false;
      }
      
      if (criteria.academicYear && criteria.academicYear !== 'Any year' && ride.driver.academicYear !== criteria.academicYear) {
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
