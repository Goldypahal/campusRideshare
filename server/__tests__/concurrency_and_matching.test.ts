import assert from "node:assert";
import { MemStorage } from "../storage";
import { calculateRideMatch } from "../services/matching.service";
import { calculateTrustScore } from "../services/reputation.service";
import type { User, Ride } from "@shared/schema";

async function runTests() {
  console.log("🧪 Running Concurrency, Smart Matching & Reputation tests...");

  // Test 1: Atomic Seat Reservation Concurrency
  const storage = new MemStorage();

  const driver = await storage.createUser({
    fullName: "Driver Jane",
    email: "jane@university.edu",
    password: "hashedpassword",
    phone: "555-1000",
    academicYear: "Senior",
    major: "Computer Science",
    gender: "Female",
  });

  const passenger1 = await storage.createUser({
    fullName: "Passenger Bob",
    email: "bob@university.edu",
    password: "hashedpassword",
    phone: "555-2000",
    academicYear: "Junior",
    major: "Economics",
    gender: "Male",
  });

  const passenger2 = await storage.createUser({
    fullName: "Passenger Alice",
    email: "alice@university.edu",
    password: "hashedpassword",
    phone: "555-3000",
    academicYear: "Sophomore",
    major: "Biology",
    gender: "Female",
  });

  // Create a ride with ONLY 1 available seat
  const ride = await storage.createRide({
    driverId: driver.id,
    origin: "Campus Quad",
    destination: "SFO Airport",
    date: "2026-10-15",
    time: "14:00",
    availableSeats: 1,
    costPerPerson: 15,
  });

  const req1 = await storage.createRideRequest({
    rideId: ride.id,
    passengerId: passenger1.id,
    seatsRequested: 1,
  });

  const req2 = await storage.createRideRequest({
    rideId: ride.id,
    passengerId: passenger2.id,
    seatsRequested: 1,
  });

  // Concurrent accept attempts
  const [res1, res2] = await Promise.all([
    storage.acceptRideRequestAtomic(req1.id, driver.id),
    storage.acceptRideRequestAtomic(req2.id, driver.id),
  ]);

  const successes = [res1, res2].filter(r => r.success);
  const failures = [res1, res2].filter(r => !r.success);

  assert.strictEqual(successes.length, 1, "Exactly one request must succeed for a 1-seat ride");
  assert.strictEqual(failures.length, 1, "The second concurrent request must fail");
  assert.ok(failures[0].error?.includes("No available seats"), "Failure message must indicate seat depletion");

  const updatedRide = await storage.getRide(ride.id);
  assert.strictEqual(updatedRide?.availableSeats, 0, "Available seats should be 0");
  assert.strictEqual(updatedRide?.status, "full", "Ride status should be marked 'full'");
  console.log("✅ Test 1 Passed: Atomic seat reservation under concurrency enforced");

  // Test 2: Reputation Trust Score Calculation
  const trust = calculateTrustScore({
    rating: 4.8,
    totalRides: 10,
    isVerified: true,
  });
  assert.ok(trust.trustScore >= 90, "Verified driver with high rating should score >= 90 trust");
  assert.strictEqual(trust.verificationComponent, 30, "Verification component should be 30");
  console.log("✅ Test 2 Passed: Dynamic Trust Score calculation verified");

  // Test 3: Multi-Factor Smart Match Engine
  const mockDriver: User = {
    id: "driver-1",
    email: "driver@university.edu",
    password: "",
    fullName: "Senior Driver",
    phone: "123",
    academicYear: "Senior",
    major: "Math",
    gender: "Female",
    isVerified: true,
    rating: 4.9,
    totalRides: 15,
    homeAirport: null,
    housingZone: null,
    createdAt: new Date(),
  };

  const mockRide: Ride = {
    id: "ride-1",
    driverId: mockDriver.id,
    origin: "Campus Library",
    destination: "SJC Airport",
    date: "2026-10-15",
    time: "10:00",
    availableSeats: 3,
    costPerPerson: 20,
    vehicle: "Civic",
    notes: null,
    isRecurring: false,
    recurrencePattern: null,
    status: "active",
    createdAt: new Date(),
  };

  const breakdown = calculateRideMatch(mockRide, mockDriver, null, {
    origin: "Campus",
    destination: "SJC",
    date: "2026-10-15",
    time: "10:15",
    timeWindow: 30,
    genderPref: "Female",
  });

  assert.ok(breakdown.totalScore >= 80, "Matching score should be high for matching origin/destination/time/gender");
  assert.ok(breakdown.reasons.length > 0, "Match breakdown should include human-readable match reasons");
  console.log("✅ Test 3 Passed: Multi-Factor Smart Match engine calculations verified");

  console.log("🎉 All concurrency & smart matching tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
