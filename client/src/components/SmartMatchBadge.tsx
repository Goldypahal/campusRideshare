import React from "react";
import { Sparkles, MapPin, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

export interface MatchBreakdownData {
  totalScore: number;
  routeScore: number;
  timeScore: number;
  trustScore: number;
  preferenceScore: number;
  spatialOverlapPct?: number;
  detourKm?: number;
  reasons: string[];
}

interface SmartMatchBadgeProps {
  matchPercentage: number;
  breakdown?: MatchBreakdownData;
  compact?: boolean;
}

export const SmartMatchBadge: React.FC<SmartMatchBadgeProps> = ({
  matchPercentage,
  breakdown,
  compact = false,
}) => {
  const getBadgeColor = (score: number) => {
    if (score >= 85) return "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-200";
    if (score >= 70) return "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-blue-200";
    if (score >= 50) return "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-200";
    return "bg-slate-200 text-slate-700";
  };

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm ${getBadgeColor(matchPercentage)}`}>
        <Sparkles className="w-3 h-3" />
        {matchPercentage}% Match
      </span>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full shadow-sm ${getBadgeColor(matchPercentage)}`}>
            <Sparkles className="w-4 h-4" />
            {matchPercentage}% AI Recommended
          </span>
          {breakdown?.spatialOverlapPct != null && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-1 rounded-full">
              {breakdown.spatialOverlapPct}% Route Overlap
            </span>
          )}
        </div>
        {breakdown?.detourKm != null && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {breakdown.detourKm} km detour
          </span>
        )}
      </div>

      {breakdown && breakdown.reasons.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Why Recommended:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {breakdown.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartMatchBadge;
