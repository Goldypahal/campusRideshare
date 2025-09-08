import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { VerificationBadge } from "@/components/safety/verification-badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders, isAuthenticated, removeAuthToken } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { User, Mail, GraduationCap, Star, Car, MessageCircle, Shield, Edit2, Save, X } from "lucide-react";
import { z } from "zod";

const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  academicYear: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]),
  gender: z.enum(["Female", "Male", "Non-binary", "Prefer not to say"]),
  major: z.string().min(1, "Major is required"),
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
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch user profile');
      return response.json();
    },
  });

  const { data: userRatings = [] } = useQuery({
    queryKey: ['/api/users', user?.id, 'ratings'],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/users/${user.id}/ratings`);
      if (!response.ok) throw new Error('Failed to fetch ratings');
      return response.json();
    },
  });

  const form = useForm<UpdateProfileData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      academicYear: user?.academicYear || "Freshman",
      gender: user?.gender || "Prefer not to say",
      major: user?.major || "",
    },
  });

  // Update form when user data is loaded
  useState(() => {
    if (user) {
      form.reset({
        fullName: user.fullName,
        academicYear: user.academicYear,
        gender: user.gender,
        major: user.major,
      });
    }
  }, [user, form.reset]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
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
    window.location.reload();
  };

  const onSubmit = (data: UpdateProfileData) => {
    updateProfileMutation.mutate(data);
  };

  const handleCancelEdit = () => {
    form.reset({
      fullName: user?.fullName,
      academicYear: user?.academicYear,
      gender: user?.gender,
      major: user?.major,
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-8">
          <p className="text-muted-foreground">User not found</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">My Profile</h2>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          data-testid="button-logout"
        >
          Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-2">
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
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label className="text-card-foreground mb-2">Full Name</Label>
                    <Input
                      {...form.register("fullName")}
                      data-testid="input-full-name"
                    />
                    {form.formState.errors.fullName && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-card-foreground mb-2">Academic Year</Label>
                      <Select 
                        value={form.watch("academicYear")} 
                        onValueChange={(value) => form.setValue("academicYear", value as any)}
                      >
                        <SelectTrigger data-testid="select-academic-year">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Freshman">Freshman</SelectItem>
                          <SelectItem value="Sophomore">Sophomore</SelectItem>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                          <SelectItem value="Graduate">Graduate</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.academicYear && (
                        <p className="text-destructive text-sm mt-1">{form.formState.errors.academicYear.message}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-card-foreground mb-2">Gender</Label>
                      <Select 
                        value={form.watch("gender")} 
                        onValueChange={(value) => form.setValue("gender", value as any)}
                      >
                        <SelectTrigger data-testid="select-gender">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Non-binary">Non-binary</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.gender && (
                        <p className="text-destructive text-sm mt-1">{form.formState.errors.gender.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-card-foreground mb-2">Major</Label>
                    <Input
                      {...form.register("major")}
                      data-testid="input-major"
                    />
                    {form.formState.errors.major && (
                      <p className="text-destructive text-sm mt-1">{form.formState.errors.major.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-card-foreground mb-2">Email</Label>
                    <Input
                      value={user.email}
                      disabled
                      data-testid="input-email-disabled"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      type="submit"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {user.fullName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold" data-testid="text-user-name">{user.fullName}</h3>
                        {user.isVerified && <VerificationBadge size="sm" />}
                      </div>
                      <p className="text-muted-foreground" data-testid="text-user-email">{user.email}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Academic Year</Label>
                      <p className="font-medium" data-testid="text-academic-year">{user.academicYear}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Gender</Label>
                      <p className="font-medium" data-testid="text-gender">{user.gender}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Major</Label>
                    <p className="font-medium" data-testid="text-major">{user.major}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats and Safety */}
        <div className="space-y-6">
          {/* Verification Status */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">University Verification</span>
                {user.isVerified ? (
                  <VerificationBadge size="sm" />
                ) : (
                  <Badge variant="outline" data-testid="badge-unverified">
                    Pending
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Email Verified</span>
                <Badge className="bg-chart-2 text-white" data-testid="badge-email-verified">
                  <Mail className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>

              {!user.isVerified && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Complete your university verification to build trust with other riders and access all features.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ride Statistics */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Ride Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Rides</span>
                <Badge variant="outline" data-testid="text-total-rides">
                  {user.totalRides}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Average Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span className="font-medium" data-testid="text-rating">
                    {user.rating > 0 ? user.rating.toFixed(1) : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Reviews Received</span>
                <Badge variant="outline" data-testid="text-reviews-count">
                  {userRatings.length}
                </Badge>
              </div>

              {user.totalRides === 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    Start offering or requesting rides to build your reputation in the community.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          {userRatings.length > 0 && (
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Recent Reviews
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {userRatings.slice(0, 3).map((rating) => (
                  <div key={rating.id} className="border-l-2 border-chart-2 pl-3">
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-3 w-3 ${i < rating.rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`} 
                        />
                      ))}
                    </div>
                    {rating.comment && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-review-${rating.id}`}>
                        "{rating.comment}"
                      </p>
                    )}
                  </div>
                ))}
                {userRatings.length > 3 && (
                  <p className="text-xs text-center text-muted-foreground">
                    +{userRatings.length - 3} more reviews
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
