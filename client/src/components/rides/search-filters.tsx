import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Search } from "lucide-react";
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
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="rounded-3xl border border-border">
      <CardContent className="p-6">
        <h3 className="text-2xl font-bold mb-6 text-card-foreground">Find Your Ride</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-card-foreground mb-2">From</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                  <Label className="text-card-foreground mb-2">To</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                  <Label className="text-card-foreground mb-2">Date</Label>
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
                  <Label className="text-card-foreground mb-2">Time</Label>
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
            
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-card-foreground">Safety Filters</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-card-foreground mb-2">Preferred Gender</Label>
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
                  <Label className="text-card-foreground mb-2">Academic Year</Label>
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
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="verified-only" 
                    checked={filters.verifiedOnly}
                    onCheckedChange={(checked) => updateFilter('verifiedOnly', !!checked)}
                    data-testid="checkbox-verified-only"
                  />
                  <Label htmlFor="verified-only" className="text-card-foreground">
                    Verified students only
                  </Label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center">
            <Button type="submit" className="px-8 py-3" data-testid="button-search-rides">
              <Search className="mr-2 h-4 w-4" />
              Search Rides
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
