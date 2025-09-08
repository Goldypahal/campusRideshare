import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { MapPin, Clock, Route, DollarSign, Car, Star, MessageCircle } from "lucide-react";
import { RideWithDriver } from "@/lib/matching";

interface RideCardProps {
  ride: RideWithDriver & { matchPercentage?: number };
  onRequestRide: (rideId: string) => void;
  onSendMessage: (driverId: string) => void;
  currentUserId?: string;
}

export default function RideCard({ ride, onRequestRide, onSendMessage, currentUserId }: RideCardProps) {
  const isOwnRide = currentUserId === ride.driver.id;
  
  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return "bg-chart-2";
    if (percentage >= 75) return "bg-chart-4";
    if (percentage >= 60) return "bg-chart-3";
    return "bg-chart-5";
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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
    <Card className="rounded-2xl border border-border hover:shadow-lg transition-shadow" data-testid={`card-ride-${ride.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {ride.driver.fullName.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-card-foreground" data-testid={`text-driver-name-${ride.id}`}>
                  {ride.driver.fullName}
                </h4>
                {ride.driver.isVerified && <VerificationBadge size="sm" showText={false} />}
              </div>
              <p className="text-sm text-muted-foreground" data-testid={`text-driver-info-${ride.id}`}>
                {ride.driver.academicYear} • {ride.driver.major}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <div className="flex text-yellow-500">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3 w-3 ${i < Math.floor(ride.driver.rating) ? 'fill-current' : ''}`} 
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground" data-testid={`text-driver-rating-${ride.id}`}>
                  {ride.driver.rating.toFixed(1)} ({ride.driver.totalRides} rides)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            {ride.matchPercentage && (
              <Badge className={`${getMatchColor(ride.matchPercentage)} text-white`} data-testid={`badge-match-${ride.id}`}>
                {ride.matchPercentage}% Match
              </Badge>
            )}
            <p className="text-sm text-muted-foreground mt-1" data-testid={`text-seats-${ride.id}`}>
              {ride.availableSeats} seats available
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-chart-1 p-2 rounded-lg">
              <MapPin className="text-white h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">From</p>
              <p className="font-medium text-card-foreground" data-testid={`text-origin-${ride.id}`}>
                {ride.origin}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-chart-3 p-2 rounded-lg">
              <MapPin className="text-white h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">To</p>
              <p className="font-medium text-card-foreground" data-testid={`text-destination-${ride.id}`}>
                {ride.destination}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-chart-4 p-2 rounded-lg">
              <Clock className="text-white h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="font-medium text-card-foreground" data-testid={`text-time-${ride.id}`}>
                {formatDate(ride.date)}, {formatTime(ride.time)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span data-testid={`text-cost-${ride.id}`}>${ride.costPerPerson} split</span>
            </div>
            {ride.vehicle && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Car className="h-4 w-4" />
                <span data-testid={`text-vehicle-${ride.id}`}>{ride.vehicle}</span>
              </div>
            )}
          </div>
          
          {!isOwnRide && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onSendMessage(ride.driver.id)}
                data-testid={`button-message-${ride.id}`}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button 
                size="sm" 
                onClick={() => onRequestRide(ride.id)}
                data-testid={`button-request-${ride.id}`}
              >
                Request Ride
              </Button>
            </div>
          )}
        </div>

        {ride.notes && (
          <div className="mt-3 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground" data-testid={`text-notes-${ride.id}`}>
              {ride.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
