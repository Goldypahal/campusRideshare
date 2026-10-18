import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertRideSchema, type InsertRide } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isAuthenticated } from "@/lib/auth";
import { useLocation } from "wouter";
import { MapPin, Calendar, Clock, DollarSign, Car, FileText, Plus, Repeat } from "lucide-react";

export default function OfferRide() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<InsertRide>({
    resolver: zodResolver(insertRideSchema),
    defaultValues: {
      origin: "",
      destination: "",
      date: "",
      time: "",
      availableSeats: 1,
      costPerPerson: 0,
      vehicle: "",
      notes: "",
      isRecurring: false,
      recurrencePattern: "",
    },
  });

  const offerRideMutation = useMutation({
    mutationFn: async (data: InsertRide) => {
      if (!isAuthenticated()) {
        throw new Error("Please login to offer rides");
      }
      
      const response = await apiRequest("POST", "/api/rides", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ride offer created!",
        description: "Your ride is now available for students to request.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rides'] });
      navigate("/my-rides");
    },
    onError: (error: Error) => {
      if (error.message.includes("login")) {
        navigate("/login");
      } else {
        toast({
          title: "Failed to create ride offer",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: InsertRide) => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    offerRideMutation.mutate(data);
  };

  const isRecurring = form.watch("isRecurring");

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="rounded-3xl border border-border">
        <CardHeader className="text-center">
          <div className="mb-4">
            <img 
              src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=300" 
              alt="Car sharing concept" 
              className="w-full h-48 object-cover rounded-2xl" 
            />
          </div>
          <CardTitle className="text-2xl font-bold text-card-foreground">Offer a Ride</CardTitle>
          <p className="text-muted-foreground">Share your journey and help fellow students get around safely</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-card-foreground mb-2">Route Details</Label>
                  <div className="space-y-3">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-chart-1 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Starting point (e.g. North Campus, ATL Airport)"
                        className="pl-10"
                        {...form.register("origin")}
                        data-testid="input-origin"
                      />
                    </div>
                    {form.formState.errors.origin && (
                      <p className="text-destructive text-sm">{form.formState.errors.origin.message}</p>
                    )}
                    
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-chart-3 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Destination (e.g. Student Union, West Quad)"
                        className="pl-10"
                        {...form.register("destination")}
                        data-testid="input-destination"
                      />
                    </div>
                    {form.formState.errors.destination && (
                      <p className="text-destructive text-sm">{form.formState.errors.destination.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-card-foreground mb-2">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        type="date"
                        className="pl-10"
                        {...form.register("date")}
                        data-testid="input-date"
                      />
                    </div>
                    {form.formState.errors.date && (
                      <p className="text-destructive text-sm">{form.formState.errors.date.message}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-card-foreground mb-2">Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        type="time"
                        className="pl-10"
                        {...form.register("time")}
                        data-testid="input-time"
                      />
                    </div>
                    {form.formState.errors.time && (
                      <p className="text-destructive text-sm">{form.formState.errors.time.message}</p>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-xl space-y-3 border">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isRecurring"
                      checked={isRecurring}
                      onCheckedChange={(checked) => form.setValue("isRecurring", !!checked)}
                    />
                    <label htmlFor="isRecurring" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1.5">
                      <Repeat className="w-4 h-4 text-primary" /> Make this a recurring campus ride
                    </label>
                  </div>
                  {isRecurring && (
                    <Select
                      value={form.watch("recurrencePattern") || ""}
                      onValueChange={(val) => form.setValue("recurrencePattern", val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Weekly - Mon/Wed/Fri">Weekly - Mon / Wed / Fri classes</SelectItem>
                        <SelectItem value="Weekly - Tue/Thu">Weekly - Tue / Thu classes</SelectItem>
                        <SelectItem value="Daily Commute">Daily Campus Commute</SelectItem>
                        <SelectItem value="Weekend Return">Weekend Return Trip</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-card-foreground mb-2">Ride Details</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Select 
                        value={form.watch("availableSeats")?.toString()} 
                        onValueChange={(value) => form.setValue("availableSeats", parseInt(value))}
                      >
                        <SelectTrigger data-testid="select-seats">
                          <SelectValue placeholder="Available seats" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 seat</SelectItem>
                          <SelectItem value="2">2 seats</SelectItem>
                          <SelectItem value="3">3 seats</SelectItem>
                          <SelectItem value="4">4 seats</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.availableSeats && (
                        <p className="text-destructive text-sm">{form.formState.errors.availableSeats.message}</p>
                      )}
                    </div>
                    <div>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          type="number"
                          placeholder="Cost per person"
                          className="pl-8"
                          {...form.register("costPerPerson", { valueAsNumber: true })}
                          data-testid="input-cost"
                        />
                      </div>
                      {form.formState.errors.costPerPerson && (
                        <p className="text-destructive text-sm">{form.formState.errors.costPerPerson.message}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label className="text-card-foreground mb-2">Vehicle Information</Label>
                  <div className="relative">
                    <Car className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Car make and model (e.g. Honda Civic)"
                      className="pl-10"
                      {...form.register("vehicle")}
                      data-testid="input-vehicle"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-card-foreground mb-2">Additional Notes</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-muted-foreground h-4 w-4" />
                    <Textarea
                      placeholder="Any special instructions, luggage limits, or music preferences..."
                      rows={3}
                      className="pl-10 resize-none"
                      {...form.register("notes")}
                      data-testid="textarea-notes"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button 
                type="submit" 
                size="lg"
                className="px-8"
                disabled={offerRideMutation.isPending}
                data-testid="button-create-offer"
              >
                <Plus className="mr-2 h-4 w-4" />
                {offerRideMutation.isPending ? "Creating Offer..." : "Create Ride Offer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
