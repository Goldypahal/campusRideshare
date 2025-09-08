import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { setAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Mail, User, GraduationCap, UserCheck } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      academicYear: "Freshman",
      gender: "Prefer not to say",
      major: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      setAuthToken(data.token);
      toast({
        title: "Registration successful!",
        description: "Welcome to UniRide. Your account has been created.",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertUser) => {
    if (!agreedToTerms) {
      toast({
        title: "Terms required",
        description: "Please agree to the Terms of Service and Safety Guidelines",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(data);
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card className="rounded-3xl border border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-card-foreground">Join UniRide</CardTitle>
          <p className="text-muted-foreground">Create your account to start sharing safe rides</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-card-foreground mb-2">University Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="email"
                  placeholder="student@university.edu"
                  className="pl-10"
                  {...form.register("email")}
                  data-testid="input-email"
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.email.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Must be a valid .edu email address</p>
            </div>

            <div>
              <Label className="text-card-foreground mb-2">Password</Label>
              <Input
                type="password"
                placeholder="Enter a secure password"
                {...form.register("password")}
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <Label className="text-card-foreground mb-2">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  {...form.register("fullName")}
                  data-testid="input-full-name"
                />
              </div>
              {form.formState.errors.fullName && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <Label className="text-card-foreground mb-2">Major/Department</Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="e.g., Computer Science"
                  className="pl-10"
                  {...form.register("major")}
                  data-testid="input-major"
                />
              </div>
              {form.formState.errors.major && (
                <p className="text-destructive text-sm mt-1">{form.formState.errors.major.message}</p>
              )}
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox 
                id="terms" 
                checked={agreedToTerms}
                onCheckedChange={setAgreedToTerms}
                data-testid="checkbox-terms"
              />
              <Label htmlFor="terms" className="text-sm text-card-foreground leading-5">
                I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Safety Guidelines</a>
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={registerMutation.isPending}
              data-testid="button-create-account"
            >
              {registerMutation.isPending ? "Creating Account..." : "Create Account"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll receive a verification email to complete registration
            </p>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login">
                <a className="text-primary hover:underline" data-testid="link-login">
                  Sign in here
                </a>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
