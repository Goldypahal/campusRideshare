import { Shield, MapPin, Star, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SafetyFeatures() {
  return (
    <Card className="rounded-3xl border border-border">
      <CardContent className="p-6">
        <h3 className="text-2xl font-bold text-card-foreground mb-6 text-center">Safety First</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center space-y-3">
            <div className="verification-badge w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Shield className="text-white text-2xl" />
            </div>
            <h4 className="font-semibold text-card-foreground">University Verified</h4>
            <p className="text-sm text-muted-foreground">All users verified with valid .edu email addresses and student ID verification</p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="safety-indicator w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <MapPin className="text-white text-2xl" />
            </div>
            <h4 className="font-semibold text-card-foreground">Live Tracking</h4>
            <p className="text-sm text-muted-foreground">Share your ride status with trusted contacts and track journey progress</p>
          </div>
          
          <div className="text-center space-y-3">
            <div className="bg-chart-4 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
              <Star className="text-white text-2xl" />
            </div>
            <h4 className="font-semibold text-card-foreground">Rating System</h4>
            <p className="text-sm text-muted-foreground">Transparent reviews and ratings help build trust within the community</p>
          </div>
        </div>

        <div className="mt-8 bg-muted rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-chart-2 p-2 rounded-lg">
                <Phone className="text-white" />
              </div>
              <div>
                <h5 className="font-semibold text-card-foreground">Emergency Support</h5>
                <p className="text-sm text-muted-foreground">24/7 campus safety hotline integration</p>
              </div>
            </div>
            <Button variant="destructive" size="sm" data-testid="button-emergency">
              Emergency
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
