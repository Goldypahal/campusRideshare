import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SafetyFeatures from "@/components/safety/safety-features";
import { Search, Plus, Users, Shield } from "lucide-react";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* CTA Section */}
      <section className="text-center bg-card rounded-3xl p-8 border border-border">
        <h3 className="text-2xl font-bold text-card-foreground mb-4">Ready to Start Riding?</h3>
        <p className="text-muted-foreground mb-6">Join thousands of university students sharing safe, affordable rides</p>
        <Link href="/register">
          <Button size="lg" data-testid="button-join-uniride">
            Join UniRide Today
          </Button>
        </Link>
      </section>

      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="relative h-64 rounded-3xl overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&h=400" 
            alt="University students with backpacks" 
            className="w-full h-full object-cover" 
          />
          <div className="hero-overlay absolute inset-0"></div>
          <div className="absolute inset-0 flex items-center justify-center text-white text-center">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold mb-4">Safe Campus Rides</h2>
              <p className="text-xl mb-6">Connect with verified students for trusted ride sharing</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/search">
                  <Button size="lg" className="min-w-[140px]" data-testid="button-find-rides">
                    <Search className="mr-2 h-5 w-5" />
                    Find Rides
                  </Button>
                </Link>
                <Link href="/offer">
                  <Button variant="secondary" size="lg" className="min-w-[140px]" data-testid="button-offer-ride">
                    <Plus className="mr-2 h-5 w-5" />
                    Offer Ride
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center">
          <CardContent className="p-6">
            <div className="bg-chart-1 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-white text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-card-foreground mb-2">University Only</h3>
            <p className="text-muted-foreground">Connect exclusively with verified university students for safer rides</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <div className="bg-chart-2 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="text-white text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-card-foreground mb-2">Safety First</h3>
            <p className="text-muted-foreground">Enhanced safety features including verification badges and rating system</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="p-6">
            <div className="bg-chart-3 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-white text-2xl" />
            </div>
            <h3 className="text-xl font-semibold text-card-foreground mb-2">Smart Matching</h3>
            <p className="text-muted-foreground">Advanced filters by gender, academic year, and route compatibility</p>
          </CardContent>
        </Card>
      </section>

      {/* How It Works */}
      <section className="bg-card rounded-3xl p-8 border border-border">
        <h3 className="text-2xl font-bold text-center text-card-foreground mb-8">How UniRide Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h4 className="font-semibold text-card-foreground mb-2">Register</h4>
            <p className="text-sm text-muted-foreground">Sign up with your university email for instant verification</p>
          </div>
          <div className="text-center">
            <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h4 className="font-semibold text-card-foreground mb-2">Search or Offer</h4>
            <p className="text-sm text-muted-foreground">Find available rides or offer your own with flexible filters</p>
          </div>
          <div className="text-center">
            <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h4 className="font-semibold text-card-foreground mb-2">Connect</h4>
            <p className="text-sm text-muted-foreground">Message verified students and arrange safe pickup details</p>
          </div>
          <div className="text-center">
            <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h4 className="font-semibold text-card-foreground mb-2">Ride Safely</h4>
            <p className="text-sm text-muted-foreground">Share the journey and rate your experience</p>
          </div>
        </div>
      </section>

      {/* Safety Features */}
      <SafetyFeatures />
    </main>
  );
}
