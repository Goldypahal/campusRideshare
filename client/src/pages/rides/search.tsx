import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import SearchFilters from "@/components/rides/search-filters";
import RideCard from "@/components/rides/ride-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { filterAndSortRides, type RideWithDriver } from "@/lib/matching";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { useLocation } from "wouter";
import { useWebSocket } from "@/hooks/useWebSocket";
import { RideCardSkeleton } from "@/components/ui/skeleton-loaders";
import { Sparkles, Car } from "lucide-react";

export default function SearchRides() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "smart">("all");

  // Connect to WebSocket for real-time notifications
  useWebSocket((event) => {
    if (!event || !event.type) return;
    if (event.type === 'ride_request_created' || event.type === 'ride_request') {
      toast({ title: 'New Ride Request', description: 'You have a new ride request' });
    }
    if (event.type === 'ride_request_status') {
      toast({ title: 'Request Update', description: `Your request was ${event.request.status}` });
    }
    if (event.type === 'sos') {
      toast({ title: '🚨 SOS Alert', description: `${event.sos.userName}: ${event.sos.message}`, variant: "destructive" });
    }
  });

  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    date: "",
    time: "",
    gender: "No preference",
    academicYear: "Any year",
    verifiedOnly: true,
  });
  const [sortBy, setSortBy] = useState<"match" | "time">("match");

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: isAuthenticated(),
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
         headers: getAuthHeaders() as Record<string, string>,
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const { data: rides = [], isLoading: isRidesLoading } = useQuery({
    queryKey: ['/api/rides'],
    queryFn: async () => {
      const response = await fetch('/api/rides');
      if (!response.ok) throw new Error('Failed to fetch rides');
      return response.json();
    },
  });

  const { data: smartMatches = [], isLoading: isSmartLoading } = useQuery({
    queryKey: ['/api/rides/smart-matches'],
    enabled: isAuthenticated() && activeTab === "smart",
    queryFn: async () => {
      const response = await fetch('/api/rides/smart-matches', {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const requestRideMutation = useMutation({
    mutationFn: async (rideId: string) => {
      if (!isAuthenticated()) {
        throw new Error("Please login to request rides");
      }
      
      const response = await apiRequest("POST", "/api/ride-requests", {
        rideId,
        message: "Hi! I'd like to join your ride.",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ride request sent!",
        description: "The driver will be notified of your request.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ride-requests'] });
    },
    onError: (error: Error) => {
      if (error.message.includes("login")) {
        navigate("/login");
      } else {
        toast({
          title: "Request failed",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const handleSearch = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleRequestRide = (rideId: string) => {
    requestRideMutation.mutate(rideId);
  };

  const handleSendMessage = (_driverId: string) => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    toast({
      title: "Direct Messaging",
      description: "Direct messaging features are active via live notifications.",
    });
  };

  const rawRides = Array.isArray(rides) ? rides : (rides?.items || []);
  const currentRidesList = activeTab === "smart" ? smartMatches : rawRides;
  const isLoading = activeTab === "smart" ? isSmartLoading : isRidesLoading;

  const filteredRides = filterAndSortRides(
    currentRidesList as RideWithDriver[],
    {
      gender: filters.gender,
      academicYear: filters.academicYear,
      verifiedOnly: filters.verifiedOnly,
    },
    filters.origin,
    filters.destination
  );

  const sortedRides = sortBy === "time" 
    ? [...filteredRides].sort((a, b) => {
        const timeA = new Date(`${a.date} ${a.time}`);
        const timeB = new Date(`${b.date} ${b.time}`);
        return timeA.getTime() - timeB.getTime();
      })
    : filteredRides;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <SearchFilters onSearch={handleSearch} />

      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold">Available Rides</h3>
            <div className="flex bg-muted p-1 rounded-lg border text-xs">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-md transition-all font-medium ${
                  activeTab === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                All Rides
              </button>
              <button
                onClick={() => setActiveTab("smart")}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1 ${
                  activeTab === "smart" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Smart Airport & Break Matches
              </button>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              variant={sortBy === "time" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("time")}
              data-testid="button-sort-time"
            >
              Sort by time
            </Button>
            <Button 
              variant={sortBy === "match" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("match")}
              data-testid="button-sort-match"
            >
              Sort by match
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <RideCardSkeleton />
            <RideCardSkeleton />
            <RideCardSkeleton />
          </div>
        ) : sortedRides.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-dashed p-8">
            <Car className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h4 className="text-lg font-semibold mb-1">No rides found matching your criteria</h4>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4" data-testid="text-no-rides">
              Try expanding your search parameters or check back soon as campus drivers post new routes daily.
            </p>
            <Button variant="outline" onClick={() => navigate("/offer")}>
              Post a Ride Offer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onRequestRide={handleRequestRide}
                onSendMessage={handleSendMessage}
                currentUserId={currentUser?.id}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
