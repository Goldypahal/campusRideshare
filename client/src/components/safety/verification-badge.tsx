import { Shield } from "lucide-react";

interface VerificationBadgeProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function VerificationBadge({ size = "md", showText = true }: VerificationBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-2 text-sm"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  return (
    <div className={`verification-badge ${sizeClasses[size]} rounded-full font-medium text-white flex items-center space-x-1`} data-testid="badge-verified">
      <Shield className={iconSizes[size]} />
      {showText && <span>Verified</span>}
    </div>
  );
}
