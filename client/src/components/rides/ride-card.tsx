import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { MapPin, Clock, DollarSign, Car, Star, MessageCircle, ArrowRight, Repeat } from "lucide-react";
import { RideWithDriver } from "@/lib/matching";

interface RideCardProps {
  ride: RideWithDriver & { matchPercentage?: number };
  onRequestRide: (rideId: string) => void;
  onSendMessage: (driverId: string) => void;
  currentUserId?: string;
}

export default function RideCard({ ride, onRequestRide, onSendMessage, currentUserId }: RideCardProps) {
  const isOwnRide = currentUserId === ride.driver.id;
  
  const getMatchBadgeStyle = (percentage: number) => {
    if (percentage >= 90) return "bg-primary text-primary-foreground";
    if (percentage >= 75) return "bg-emerald-600 text-white";
    return "bg-secondary text-secondary-foreground";
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const formatDate = (date: string) => {
    const today = new Date();
    const rideDate = new Date(date);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (rideDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (rideDate.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return rideDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm hover:border-primary/50 transition-all" data-testid={`card-ride-${ride.id}`}>
      <CardContent className="p-6 space-y-4">
        
        {/* Header: Driver Info & Match Score */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <Avatar className="w-12 h-12 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {ride.driver.fullName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-serif text-lg font-bold text-foreground" data-testid={`text-driver-name-${ride.id}`}>
                  {ride.driver.fullName}
                </h4>
                <VerificationBadge isVerified={ride.driver.isVerified ?? true} size="sm" showText={false} />
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`text-driver-info-${ride.id}`}>
                {ride.driver.academicYear} • {ride.driver.major}
              </p>
              <div className="flex items-center space-x-1.5 mt-1">
                <div className="flex text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${i < Math.floor(ride.driver.rating || 5) ? 'fill-current' : ''}`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground" data-testid={`text-driver-rating-${ride.id}`}>
                  {(ride.driver.rating || 5).toFixed(1)} ({ride.driver.totalRides || 0} rides)
                </span>
              </div>
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-1">
            {ride.matchPercentage && (
              <Badge className={`${getMatchBadgeStyle(ride.matchPercentage)} px-3 py-1 font-semibold text-xs rounded-full`} data-testid={`badge-match-${ride.id}`}>
                {ride.matchPercentage}% Match
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-medium" data-testid={`text-seats-${ride.id}`}>
              {ride.availableSeats} seat{ride.availableSeats > 1 ? 's' : ''} left
            </span>
          </div>
        </div>

        {/* Route Details */}
        <div className="bg-muted/40 p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary"></div>
              <div className="w-px h-6 border-l border-dashed border-secondary/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-semibold">From</span>
                <span className="font-serif font-bold text-foreground" data-testid={`text-origin-${ride.id}`}>{ride.origin}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-semibold">To</span>
                <span className="font-serif font-bold text-foreground" data-testid={`text-destination-${ride.id}`}>{ride.destination}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-background px-3 py-2 rounded-lg border border-border/80 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span data-testid={`text-time-${ride.id}`}>{formatDate(ride.date)}, {formatTime(ride.time)}</span>
          </div>
        </div>

        {/* Footer: Price, Vehicle & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1 font-semibold text-primary text-base font-serif">
              <DollarSign className="h-4 w-4 text-primary" />
              <span data-testid={`text-cost-${ride.id}`}>{ride.costPerPerson}</span>
              <span className="text-xs font-normal text-muted-foreground">/ person</span>
            </div>
            {ride.vehicle && (
              <div className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                <span data-testid={`text-vehicle-${ride.id}`}>{ride.vehicle}</span>
              </div>
            )}
            {ride.isRecurring && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 flex items-center gap-1">
                <Repeat className="w-3 h-3" /> {ride.recurrencePattern || 'Recurring'}
              </Badge>
            )}
          </div>

          {!isOwnRide && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSendMessage(ride.driver.id)}
                data-testid={`button-message-${ride.id}`}
                className="gap-1 text-xs"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Message
              </Button>
              <Button 
                size="sm" 
                onClick={() => onRequestRide(ride.id)}
                data-testid={`button-request-${ride.id}`}
                className="gap-1 text-xs font-semibold"
              >
                Request Ride
              </Button>
            </div>
          )}
        </div>

        {ride.notes && (
          <p className="text-xs text-muted-foreground italic bg-muted/30 p-2.5 rounded-lg" data-testid={`text-notes-${ride.id}`}>
            "{ride.notes}"
          </p>
        )}
      </CardContent>
    </Card>
  );
}
