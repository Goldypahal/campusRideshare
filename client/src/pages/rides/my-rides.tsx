import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { useLocation } from "wouter";
import { MapPin, Calendar, Clock, Users, Car, MessageCircle, Check, X } from "lucide-react";

export default function MyRides() {
  const [, navigate] = useLocation();

  if (!isAuthenticated()) {
    navigate("/login");
    return null;
  }

  const { data: myOffers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['/api/rides/my'],
    queryFn: async () => {
      const response = await fetch('/api/rides/my', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch my rides');
      return response.json();
    },
  });

  const { data: myRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['/api/ride-requests/my'],
    queryFn: async () => {
      const response = await fetch('/api/ride-requests/my', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch my requests');
      return response.json();
    },
  });

  const formatDateTime = (date: string, time: string) => {
    const rideDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dateStr;
    if (rideDate.toDateString() === today.toDateString()) {
      dateStr = "Today";
    } else if (rideDate.toDateString() === tomorrow.toDateString()) {
      dateStr = "Tomorrow";
    } else {
      dateStr = rideDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    return `${dateStr}, ${timeStr}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-chart-2 text-white";
      case "full": return "bg-chart-3 text-white";
      case "completed": return "bg-chart-4 text-white";
      case "cancelled": return "bg-muted text-muted-foreground";
      case "pending": return "bg-chart-3 text-white";
      case "accepted": return "bg-chart-2 text-white";
      case "rejected": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (offersLoading || requestsLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading your rides...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">My Rides</h2>
        <Button onClick={() => navigate("/offer")} data-testid="button-offer-new-ride">
          Offer New Ride
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* My Ride Offers */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              My Ride Offers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myOffers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4" data-testid="text-no-offers">
                You haven't offered any rides yet.
              </p>
            ) : (
              myOffers.map((ride) => (
                <div key={ride.id} className="border border-border rounded-lg p-4 space-y-3" data-testid={`card-offer-${ride.id}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-chart-1" />
                        <span className="font-medium" data-testid={`text-route-${ride.id}`}>
                          {ride.origin} → {ride.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span data-testid={`text-datetime-${ride.id}`}>
                          {formatDateTime(ride.date, ride.time)}
                        </span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(ride.status)} data-testid={`badge-status-${ride.id}`}>
                      {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {ride.availableSeats} seats
                      </span>
                      <span>${ride.costPerPerson}/person</span>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`button-manage-${ride.id}`}>
                      Manage
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* My Ride Requests */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              My Ride Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-4" data-testid="text-no-requests">
                You haven't requested any rides yet.
              </p>
            ) : (
              myRequests.map((request) => (
                <div key={request.id} className="border border-border rounded-lg p-4 space-y-3" data-testid={`card-request-${request.id}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-chart-1" />
                        <span className="font-medium" data-testid={`text-request-route-${request.id}`}>
                          {request.ride?.origin} → {request.ride?.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span data-testid={`text-request-datetime-${request.id}`}>
                          {request.ride && formatDateTime(request.ride.date, request.ride.time)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-driver-${request.id}`}>
                        Driver: {request.driver?.fullName}
                      </div>
                    </div>
                    <Badge className={getStatusColor(request.status)} data-testid={`badge-request-status-${request.id}`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">${request.ride?.costPerPerson}/person</span>
                    <div className="flex gap-2">
                      {request.status === "accepted" && (
                        <Button variant="outline" size="sm" data-testid={`button-contact-${request.id}`}>
                          Contact Driver
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
