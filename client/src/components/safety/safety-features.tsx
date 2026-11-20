import { useState } from "react";
import { Shield, MapPin, Star, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAuthHeaders, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function SafetyFeatures() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentConfirmed, setIncidentConfirmed] = useState<any>(null);

  const handleTriggerSOS = async () => {
    if (!isAuthenticated()) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to broadcast an emergency SOS alert to campus responders.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    let coords: { latitude?: number; longitude?: number } = {};

    if ("geolocation" in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } catch (err) {
        console.warn("Could not retrieve precise GPS coordinates:", err);
      }
    }

    try {
      const response = await fetch("/api/safety/sos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getAuthHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          message: "Emergency SOS triggered from student dashboard",
          severity: "critical",
          ...coords,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to broadcast emergency alert");
      }

      setIncidentConfirmed(data);
      toast({
        title: "SOS Alert Dispatched",
        description: "Campus safety responders have been notified with your alert.",
      });
    } catch (err: any) {
      toast({
        title: "Error Dispatching SOS",
        description: err.message || "Please call 112 or Campus Security directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="rounded-3xl border border-border">
        <CardContent className="p-6">
          <h3 className="text-2xl font-bold text-card-foreground mb-6 text-center">Safety First</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="verification-badge w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Shield className="text-white text-2xl" />
              </div>
              <h4 className="font-semibold text-card-foreground">University Verified</h4>
              <p className="text-sm text-muted-foreground">
                All users authenticated with verified institutional campus email addresses
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="safety-indicator w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <MapPin className="text-white text-2xl" />
              </div>
              <h4 className="font-semibold text-card-foreground">Active Journey Coordination</h4>
              <p className="text-sm text-muted-foreground">
                Real-time incident dispatch and route safety tracking for active trips
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="bg-chart-4 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <Star className="text-white text-2xl" />
              </div>
              <h4 className="font-semibold text-card-foreground">Reputation & Trust</h4>
              <p className="text-sm text-muted-foreground">
                Multi-factor trust scores and verified community ratings protect every ride
              </p>
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
                  <p className="text-sm text-muted-foreground">
                    Direct responder SOS alert and campus security escalation
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                data-testid="button-emergency"
                onClick={() => {
                  setIncidentConfirmed(null);
                  setIsOpen(true);
                }}
              >
                Emergency
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Emergency Safety Assistance
            </DialogTitle>
            <DialogDescription>
              {incidentConfirmed
                ? "Your SOS alert has been logged into the durable security incident queue."
                : "Trigger an immediate SOS incident alert to on-duty campus responders, or connect directly to local emergency services."}
            </DialogDescription>
          </DialogHeader>

          {incidentConfirmed ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Incident Dispatched: #{incidentConfirmed.incident?.id?.slice(0, 8)}
              </div>
              <p className="text-muted-foreground">
                Status: {incidentConfirmed.deliveryStatus} (Active Responders Online:{" "}
                {incidentConfirmed.respondersOnline})
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex flex-col gap-2">
                <a href="tel:112" className="w-full">
                  <Button variant="outline" className="w-full gap-2 border-destructive text-destructive">
                    <Phone className="w-4 h-4" /> Call 112 (National Emergency Helpline)
                  </Button>
                </a>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {incidentConfirmed ? (
              <Button onClick={() => setIsOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleTriggerSOS}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Dispatching..." : "Broadcast SOS Alert"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
