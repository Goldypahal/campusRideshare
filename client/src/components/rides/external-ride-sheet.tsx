import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isAuthenticated } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { ExternalLink, Copy, Check, ShieldAlert, Info, MapPin, ArrowRight, Loader2, Calculator } from "lucide-react";

export interface ExternalRideProviderInfo {
  id: "uber" | "ola" | "rapido";
  displayName: string;
  modes: Array<"cab" | "auto" | "bike">;
  capabilities: {
    handoff: boolean;
    prefillsLocations: boolean;
    estimates: boolean;
    inAppBooking: boolean;
  };
}

export interface ExternalRideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickupLabel: string;
  dropoffLabel: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  reason?: "no_match" | "low_match" | "too_soon" | "manual";
}

export function ExternalRideSheet({
  open,
  onOpenChange,
  pickupLabel,
  dropoffLabel,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  reason = "manual",
}: ExternalRideSheetProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [calculatorFare, setCalculatorFare] = useState<string>("");
  const [calculatorRiders, setCalculatorRiders] = useState<number>(2);

  const fareNum = Math.max(0, parseFloat(calculatorFare) || 0);
  const perPersonAmount = calculatorRiders > 0 && fareNum > 0 ? Math.ceil(fareNum / calculatorRiders) : 0;

  // Fetch enabled external providers
  const { data: providersData, isLoading: isProvidersLoading } = useQuery<{
    providers: ExternalRideProviderInfo[];
    settings: { matchThreshold: number; soonMinutes: number };
  }>({
    queryKey: ["/api/external-rides/providers"],
    enabled: open && isAuthenticated(),
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/external-rides/providers");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || "Failed to load external ride providers");
      }
      return res.json();
    },
  });

  const providers = providersData?.providers || [];

  // Copy locations to clipboard
  const handleCopyLocations = async () => {
    const textToCopy = `Pickup: ${pickupLabel || "Campus"}\nDrop-off: ${dropoffLabel || "Destination"}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast({
        title: "Locations copied!",
        description: "Pickup and drop-off text copied to clipboard to paste into external apps.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      toast({
        title: "Could not copy",
        description: "Please copy your pickup and drop-off manually.",
        variant: "destructive",
      });
    }
  };

  // Handoff mutation
  const handoffMutation = useMutation({
    mutationFn: async ({
      providerId,
      preOpenedWindow,
    }: {
      providerId: "uber" | "ola" | "rapido";
      preOpenedWindow: Window | null;
    }) => {
      setActiveProviderId(providerId);

      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const platform = isAndroid ? "android" : isIOS ? "ios" : "web";

      const res = await apiRequest("POST", "/api/external-rides/handoffs", {
        providerId,
        pickup: {
          label: pickupLabel || "Campus",
          lat: pickupLat,
          lng: pickupLng,
        },
        dropoff: {
          label: dropoffLabel || "Destination",
          lat: dropoffLat,
          lng: dropoffLng,
        },
        platform,
        context: {
          reason,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || `Request failed with status ${res.status}`);
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      setActiveProviderId(null);
      if (data?.url) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = data.url;
        } else if (variables.preOpenedWindow) {
          variables.preOpenedWindow.location.href = data.url;
          try {
            variables.preOpenedWindow.opener = null;
          } catch (e) {}
        } else {
          const opened = window.open(data.url, "_blank");
          if (opened) {
            try {
              opened.opener = null;
            } catch (e) {}
          }
        }
      } else if (variables.preOpenedWindow) {
        try {
          variables.preOpenedWindow.close();
        } catch (e) {}
      }
    },
    onError: (error: Error, variables) => {
      setActiveProviderId(null);
      if (variables?.preOpenedWindow) {
        try {
          variables.preOpenedWindow.close();
        } catch (e) {}
      }
      toast({
        title: "Handoff failed",
        description: error.message || "Failed to connect to external provider.",
        variant: "destructive",
      });
    },
  });

  const handleProviderClick = (providerId: "uber" | "ola" | "rapido") => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let preOpenedWindow: Window | null = null;
    if (!isMobile) {
      preOpenedWindow = window.open("about:blank", "_blank");
    }
    handoffMutation.mutate({ providerId, preOpenedWindow });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto p-6 space-y-6"
        data-testid="external-ride-sheet"
      >
        <SheetHeader className="text-left space-y-1">
          <SheetTitle className="text-xl font-bold">
            No campus ride fits? Book with another app
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Continue your trip immediately using verified external ride services.
          </SheetDescription>
        </SheetHeader>

        {/* Selected Route Display & Copy Button */}
        <div className="bg-muted/50 border rounded-lg p-3 space-y-3">
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">Pickup:</span>
              <span className="truncate" data-testid="text-pickup-label">
                {pickupLabel || "Current Location / Campus"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-muted-foreground">Drop-off:</span>
              <span className="truncate" data-testid="text-dropoff-label">
                {dropoffLabel || "Destination"}
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLocations}
            className="w-full flex items-center justify-center gap-2 text-xs"
            data-testid="button-copy-locations"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                Copied to clipboard
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy pickup & drop-off text
              </>
            )}
          </Button>
        </div>

        {/* Safety Disclosure (Rule 5) */}
        <div
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1"
          data-testid="external-safety-disclosure"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            Safety Disclosure
          </div>
          <p className="leading-relaxed">
            CampusRide's safety features (SOS alerts, live trip sharing, verified student community)
            do <strong>not</strong> cover rides booked with outside companies. Please use the
            provider's in-app safety tools and dial <strong>112</strong> for any emergency.
          </p>
        </div>

        {/* Privacy Disclosure (Rule 6) */}
        <div
          className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1"
          data-testid="external-privacy-disclosure"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            Privacy Disclosure
          </div>
          <p className="leading-relaxed">
            Opening a ride provider's link sends your pickup and drop-off locations directly to their
            service. CampusRide records only the provider name and timestamp for audit purposes.
          </p>
        </div>

        {/* Provider List */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available Providers
          </h4>

          {isProvidersLoading ? (
            <div className="py-6 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading available ride services...
            </div>
          ) : providers.length === 0 ? (
            <div className="p-4 text-center border rounded-lg text-sm text-muted-foreground">
              No external ride providers are currently configured or enabled.
            </div>
          ) : (
            providers.map((p) => {
              const isPending = handoffMutation.isPending && activeProviderId === p.id;
              const modeList = p.modes
                .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                .join(" · ");

              return (
                <div
                  key={p.id}
                  className="border rounded-lg p-4 space-y-3 bg-card hover:bg-accent/40 transition-colors"
                  data-testid={`card-provider-${p.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-semibold text-base">{p.displayName}</h5>
                      <p className="text-xs text-muted-foreground mt-0.5">{modeList}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {p.capabilities.prefillsLocations ? "Direct Link" : "Store App"}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {p.capabilities.prefillsLocations
                      ? "Pickup and drop filled in for you"
                      : "You'll enter the locations in their app"}
                  </p>

                  <Button
                    type="button"
                    className="w-full flex items-center justify-center gap-2"
                    disabled={handoffMutation.isPending}
                    onClick={() => handleProviderClick(p.id)}
                    data-testid={`button-open-${p.id}`}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Connecting to {p.displayName}...
                      </>
                    ) : (
                      <>
                        <span>Continue with {p.displayName}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Optional Fare-Split Calculator (Local Only) */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="card-fare-split-calculator">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Calculator className="w-4 h-4 text-primary" />
            <span>Split the Fare Calculator</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-normal">
            Purely local helper. Check the estimated fare in the cab app and enter it here to calculate each person's share.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Estimated Fare (₹)
              </label>
              <Input
                type="number"
                min="0"
                step="10"
                placeholder="e.g. 250"
                value={calculatorFare}
                onChange={(e) => setCalculatorFare(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-fare-amount"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Riders
              </label>
              <Input
                type="number"
                min="1"
                max="6"
                step="1"
                value={calculatorRiders}
                onChange={(e) => setCalculatorRiders(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-8 text-xs"
                data-testid="input-fare-riders"
              />
            </div>
          </div>

          {fareNum > 0 && (
            <div className="bg-background border rounded p-2.5 flex items-center justify-between text-xs mt-2">
              <span className="text-muted-foreground">Each person pays:</span>
              <span className="font-bold text-sm text-primary" data-testid="text-per-person-fare">
                ₹{perPersonAmount}
              </span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
