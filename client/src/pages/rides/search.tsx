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

export default function SearchRides() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
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
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
  });

  const { data: rides = [], isLoading } = useQuery({
    queryKey: ['/api/rides'],
    queryFn: async () => {
      const response = await fetch('/api/rides');
      if (!response.ok) throw new Error('Failed to fetch rides');
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

  const handleSendMessage = (driverId: string) => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    
    // TODO: Implement messaging modal/page
    toast({
      title: "Messaging feature",
      description: "Direct messaging will be available soon!",
    });
  };

  // Filter and sort rides
  const filteredRides = filterAndSortRides(
    rides as RideWithDriver[],
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
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-bold">Available Rides</h3>
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
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading rides...</p>
          </div>
        ) : sortedRides.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground" data-testid="text-no-rides">
              No rides found matching your criteria. Try adjusting your filters.
            </p>
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
