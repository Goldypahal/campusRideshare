export interface UserReputation {
  rating?: number | null;
  totalRides?: number | null;
  isVerified?: boolean | null;
}

export interface TrustScoreResult {
  trustScore: number; // 0 to 100
  ratingComponent: number;
  verificationComponent: number;
  experienceComponent: number;
}

/**
 * Calculates dynamic Trust Score (0-100) based on user metrics
 */
export function calculateTrustScore(user: UserReputation): TrustScoreResult {
  const rating = user.rating ?? 4.5;
  const ratingComponent = Math.round(Math.min((rating / 5) * 50, 50));
  const verificationComponent = user.isVerified ? 30 : 0;
  const experienceComponent = Math.round(Math.min((user.totalRides ?? 0) * 2, 20));

  const trustScore = ratingComponent + verificationComponent + experienceComponent;

  return {
    trustScore: Math.min(trustScore, 100),
    ratingComponent,
    verificationComponent,
    experienceComponent,
  };
}
