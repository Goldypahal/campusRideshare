import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, ShieldCheck, Leaf, DollarSign, MapPin, Calendar, Clock, ArrowRight, Car } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { isAuthenticated, getAuthHeaders } from "@/lib/auth";
import { VerificationBadge } from "@/components/safety/verification-badge";
import SafetyFeatures from "@/components/safety/safety-features";
import { RideCardSkeleton } from "@/components/ui/skeleton-loaders";

export default function Home() {
  const [, navigate] = useLocation();
  const isAuth = isAuthenticated();

  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: isAuth,
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: userStats } = useQuery({
    queryKey: ['/api/users', currentUser?.id, 'stats'],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const response = await fetch(`/api/users/${currentUser.id}/stats`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: activeRides = [], isLoading: isRidesLoading } = useQuery({
    queryKey: ['/api/rides'],
    queryFn: async () => {
      const response = await fetch('/api/rides?limit=3');
      if (!response.ok) return [];
      return response.json();
    },
  });

  return (
    <div className="parchment-canvas min-h-[calc(100vh-4rem)] pb-16">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Welcome Section */}
        <section className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-serif font-bold text-foreground">
              Hello, {currentUser?.fullName?.split(' ')[0] || 'Student'}
            </h2>
            <VerificationBadge isVerified={currentUser?.isVerified ?? true} size="sm" showText={false} />
          </div>
          <p className="text-muted-foreground text-sm">
            {currentUser?.major
              ? `Ready for your campus commute in ${currentUser.major}?`
              : "Connecting verified university students for safe, affordable rides."}
          </p>
        </section>

        {/* Bento Box Sustainability Dashboard */}
        <section className="bg-card border border-border p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sustainability & Community Impact
            </h3>
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <Leaf className="w-3.5 h-3.5" /> Verified .edu Network
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">CO₂ Emissions Saved</p>
                <p className="text-2xl font-serif font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                  {userStats?.co2SavedKg ?? 12} kg
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Equivalent to planting ~2 campus trees</p>
              </div>
              <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-600">
                <Leaf className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-primary font-medium">Commute Cost Saved</p>
                <p className="text-2xl font-serif font-bold text-primary mt-1">
                  ${userStats?.moneySavedUsd ?? 45}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Saved vs. commercial rideshares</p>
              </div>
              <div className="p-3 bg-primary/20 rounded-full text-primary">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions Buttons */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            size="lg"
            className="h-20 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center gap-3 shadow-md hover:brightness-105 active:scale-[0.99] transition-all"
            onClick={() => navigate('/search')}
          >
            <Search className="w-6 h-6" />
            <div className="text-left">
              <p className="text-base font-bold">Find a Ride</p>
              <p className="text-xs opacity-90 font-normal">Search student routes & class commutes</p>
            </div>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-20 bg-card border-secondary text-secondary rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:bg-secondary/10 active:scale-[0.99] transition-all"
            onClick={() => navigate('/offer')}
          >
            <Car className="w-6 h-6" />
            <div className="text-left">
              <p className="text-base font-bold">Offer a Ride</p>
              <p className="text-xs text-muted-foreground font-normal">Share your route & split gas costs</p>
            </div>
          </Button>
        </section>

        {/* Active Campus Rides Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-serif font-bold">Active Campus Rides</h3>
            <Link href="/search" className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
              View All Rides <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isRidesLoading ? (
            <div className="space-y-3">
              <RideCardSkeleton />
              <RideCardSkeleton />
            </div>
          ) : activeRides.length === 0 ? (
            <Card className="rounded-2xl border border-dashed p-6 text-center">
              <Car className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No active campus rides posted right now.</p>
              <Button variant="link" size="sm" onClick={() => navigate('/offer')}>
                Be the first to post a ride offer!
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeRides.slice(0, 3).map((ride: any) => (
                <Card key={ride.id} className="rounded-2xl border border-border hover:border-primary/40 transition-colors shadow-sm">
                  <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
                          {ride.date} • {ride.time}
                        </span>
                        {ride.isRecurring && (
                          <span className="bg-emerald-500/10 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            Recurring
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-serif font-semibold text-lg">
                        <span>{ride.origin}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <span>{ride.destination}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Driver: {ride.driver?.fullName || 'Verified Driver'} ({ride.driver?.academicYear || 'Student'})
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
                      <span className="text-xl font-serif font-bold text-primary">
                        ${ride.costPerPerson} <span className="text-xs font-normal text-muted-foreground">/seat</span>
                      </span>
                      <Button size="sm" onClick={() => navigate('/search')}>
                        Request Ride
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Safety Features Section */}
        <SafetyFeatures />

      </main>
    </div>
  );
}
