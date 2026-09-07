import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders, isAuthenticated, removeAuthToken } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { User, Mail, GraduationCap, Star, Car, Shield, Edit2, Save, X, Leaf, DollarSign, Plane, Building } from "lucide-react";
import { ProfileSkeleton } from "@/components/ui/skeleton-loaders";
import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  academicYear: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]),
  gender: z.enum(["Female", "Male", "Non-binary", "Prefer not to say"]),
  major: z.string().min(1, "Major is required"),
  homeAirport: z.string().optional(),
  housingZone: z.string().optional(),
});

type UpdateProfileData = z.infer<typeof updateProfileSchema>;

export default function Profile() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  if (!isAuthenticated()) {
    navigate("/login");
    return null;
  }

  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        headers: getAuthHeaders() as Record<string, string>,
      });
      if (!response.ok) throw new Error('Failed to fetch user profile');
      return response.json();
    },
  });

  const { data: userStats } = useQuery({
    queryKey: ['/api/users', user?.id, 'stats'],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/users/${user.id}/stats`);
      if (!response.ok) return null;
      return response.json();
    },
  });

  const { data: userRatings = [] } = useQuery({
    queryKey: ['/api/users', user?.id, 'ratings'],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/users/${user.id}/ratings`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: "",
      academicYear: "Freshman",
      gender: "Prefer not to say",
      major: "",
      homeAirport: "",
      housingZone: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        academicYear: user.academicYear || "Freshman",
        gender: user.gender || "Prefer not to say",
        major: user.major || "",
        homeAirport: user.homeAirport || "",
        housingZone: user.housingZone || "",
      });
    }
  }, [user, form.reset]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await apiRequest("PATCH", "/api/users/me", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated!",
        description: "Your profile information has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    removeAuthToken();
    navigate('/');
  };

  const onSubmit = (data: UpdateProfileData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) return null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">My Profile</h2>
        <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
          Sign Out
        </Button>
      </div>

      {/* Sustainability & Personal Impact Dashboard */}
      {userStats && (
        <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-emerald-600" />
              Personal Sustainability & Impact
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-background/80 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs text-muted-foreground font-medium uppercase">CO₂ Emissions Saved</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {userStats.co2SavedKg || 0} kg
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Equivalent to planting {Math.ceil((userStats.co2SavedKg || 0) / 10)} trees</p>
            </div>
            <div className="bg-background/80 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs text-muted-foreground font-medium uppercase">Estimated Money Saved</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                ${userStats.moneySavedUsd || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Vs. solo rideshare apps</p>
            </div>
            <div className="bg-background/80 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-xs text-muted-foreground font-medium uppercase">Total Campus Trips</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {userStats.totalTrips || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Offered + Joined rides</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    data-testid="button-edit-profile"
                  >
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label className="text-card-foreground mb-2">Full Name</Label>
                    <Input {...form.register("fullName")} data-testid="input-full-name" />
                    {form.formState.errors.fullName && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-card-foreground mb-2">Academic Year</Label>
                      <Controller
                        name="academicYear"
                        control={form.control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Freshman">Freshman</SelectItem>
                              <SelectItem value="Sophomore">Sophomore</SelectItem>
                              <SelectItem value="Junior">Junior</SelectItem>
                              <SelectItem value="Senior">Senior</SelectItem>
                              <SelectItem value="Graduate">Graduate</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div>
                      <Label className="text-card-foreground mb-2">Major</Label>
                      <Input {...form.register("major")} data-testid="input-major" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <Label className="text-card-foreground mb-2 flex items-center gap-1">
                        <Plane className="w-3.5 h-3.5 text-primary" /> Home Airport (Break Return)
                      </Label>
                      <Input placeholder="e.g. ATL, LAX, ORD" {...form.register("homeAirport")} />
                    </div>
                    <div>
                      <Label className="text-card-foreground mb-2 flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-primary" /> Campus Housing Zone
                      </Label>
                      <Input placeholder="e.g. West Campus Quad" {...form.register("housingZone")} />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    <Button type="submit" disabled={updateProfileMutation.isPending}>
                      <Save className="h-4 w-4 mr-1" /> Save Changes
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                        {user.fullName.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold flex items-center gap-2">
                        {user.fullName}
                        <VerificationBadge isVerified={user.isVerified ?? false} />
                      </h3>
                      <p className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Mail className="h-3.5 w-3.5" /> {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Academic Status</p>
                      <p className="font-medium flex items-center gap-1.5 mt-0.5">
                        <GraduationCap className="h-4 w-4 text-primary" /> {user.academicYear} in {user.major}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Driver Rating</p>
                      <p className="font-medium flex items-center gap-1 mt-0.5">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {user.rating || "New"} ({user.totalRides || 0} rides)
                      </p>
                    </div>
                  </div>

                  {(user.homeAirport || user.housingZone) && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t bg-muted/30 p-3 rounded-lg">
                      {user.homeAirport && (
                        <div>
                          <p className="text-xs text-muted-foreground">Home Airport</p>
                          <p className="font-medium flex items-center gap-1 text-sm mt-0.5">
                            <Plane className="w-3.5 h-3.5 text-primary" /> {user.homeAirport}
                          </p>
                        </div>
                      )}
                      {user.housingZone && (
                        <div>
                          <p className="text-xs text-muted-foreground">Campus Zone</p>
                          <p className="font-medium flex items-center gap-1 text-sm mt-0.5">
                            <Building className="w-3.5 h-3.5 text-primary" /> {user.housingZone}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Verification & Trust */}
        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-5 w-5 text-emerald-600" />
                Trust & Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10">
                <span className="text-sm font-medium">University Email</span>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
                  Verified .edu
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10">
                <span className="text-sm font-medium">Student Identity</span>
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  Active Student
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
