import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Search, Shield, Filter } from "lucide-react";
import { useState } from "react";

interface SearchFiltersProps {
  onSearch: (filters: {
    origin: string;
    destination: string;
    date: string;
    time: string;
    gender: string;
    academicYear: string;
    verifiedOnly: boolean;
  }) => void;
}

export default function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [filters, setFilters] = useState({
    origin: "",
    destination: "",
    date: "",
    time: "",
    gender: "No preference",
    academicYear: "Any year",
    verifiedOnly: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const updateFilter = (key: string, value: string | boolean) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onSearch(updated);
  };

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-serif font-bold text-foreground">Find Your Ride</h3>
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-primary" /> Safety Filters Active
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase font-semibold text-muted-foreground mb-1.5 block">From</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Starting location"
                      className="pl-10"
                      value={filters.origin}
                      onChange={(e) => updateFilter('origin', e.target.value)}
                      data-testid="input-origin"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase font-semibold text-muted-foreground mb-1.5 block">To</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Destination"
                      className="pl-10"
                      value={filters.destination}
                      onChange={(e) => updateFilter('destination', e.target.value)}
                      data-testid="input-destination"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase font-semibold text-muted-foreground mb-1.5 block">Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="date"
                      className="pl-10"
                      value={filters.date}
                      onChange={(e) => updateFilter('date', e.target.value)}
                      data-testid="input-date"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase font-semibold text-muted-foreground mb-1.5 block">Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      type="time"
                      className="pl-10"
                      value={filters.time}
                      onChange={(e) => updateFilter('time', e.target.value)}
                      data-testid="input-time"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 bg-muted/40 p-4 rounded-xl border border-border/60">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" /> Campus Safety Filters
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Preferred Gender</Label>
                    <Select value={filters.gender} onValueChange={(value) => updateFilter('gender', value)}>
                      <SelectTrigger data-testid="select-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="No preference">No preference</SelectItem>
                        <SelectItem value="Female">Female only</SelectItem>
                        <SelectItem value="Male">Male only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Academic Year</Label>
                    <Select value={filters.academicYear} onValueChange={(value) => updateFilter('academicYear', value)}>
                      <SelectTrigger data-testid="select-academic-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Any year">Any year</SelectItem>
                        <SelectItem value="Freshman">Freshman</SelectItem>
                        <SelectItem value="Sophomore">Sophomore</SelectItem>
                        <SelectItem value="Junior">Junior</SelectItem>
                        <SelectItem value="Senior">Senior</SelectItem>
                        <SelectItem value="Graduate">Graduate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox 
                    id="verified-only" 
                    checked={filters.verifiedOnly}
                    onCheckedChange={(checked) => updateFilter('verifiedOnly', !!checked)}
                    data-testid="checkbox-verified-only"
                  />
                  <Label htmlFor="verified-only" className="text-xs font-medium cursor-pointer">
                    Verified .edu students only
                  </Label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center pt-2">
            <Button type="submit" size="lg" className="px-8 font-semibold gap-2" data-testid="button-search-rides">
              <Search className="h-4 w-4" />
              Search Available Rides
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
