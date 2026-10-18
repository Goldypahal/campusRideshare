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
    academicYear: "Senior",
    major: "Computer Science",
    gender: "Female",
  });

  const passenger1 = await storage.createUser({
    fullName: "Passenger Bob",
    email: "bob@university.edu",
    password: "hashedpassword",
    academicYear: "Junior",
    major: "Economics",
    gender: "Male",
  });

  const passenger2 = await storage.createUser({
    fullName: "Passenger Alice",
    email: "alice@university.edu",
    password: "hashedpassword",
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
  assert.ok(failures[0].error?.includes("Not enough available seats"), "Failure message must indicate seat depletion");

  const updatedRide = await storage.getRide(ride.id);
  assert.strictEqual(updatedRide?.availableSeats, 0, "Available seats should be 0");
  assert.strictEqual(updatedRide?.status, "full", "Ride status should be marked 'full'");
  console.log("✅ Test 1 Passed: Atomic seat reservation under concurrency enforced");

  // Test 1b: Multi-Seat Atomic Concurrency & State Invariant
  const multiSeatRide = await storage.createRide({
    driverId: driver.id,
    origin: "Hostel Block",
    destination: "Delhi Airport",
    date: "2026-10-20",
    time: "08:00",
    availableSeats: 2,
    costPerPerson: 25,
  });

  const multiReq1 = await storage.createRideRequest({
    rideId: multiSeatRide.id,
    passengerId: passenger1.id,
    seatsRequested: 2,
  });

  const multiReq2 = await storage.createRideRequest({
    rideId: multiSeatRide.id,
    passengerId: passenger2.id,
    seatsRequested: 2,
  });

  // Both requesting 2 seats when only 2 exist
  const [multiRes1, multiRes2] = await Promise.all([
    storage.acceptRideRequestAtomic(multiReq1.id, driver.id),
    storage.acceptRideRequestAtomic(multiReq2.id, driver.id),
  ]);

  const multiSuccesses = [multiRes1, multiRes2].filter(r => r.success);
  const multiFailures = [multiRes1, multiRes2].filter(r => !r.success);

  assert.strictEqual(multiSuccesses.length, 1, "Only one 2-seat request can be accepted on a 2-seat ride");
  assert.strictEqual(multiFailures.length, 1, "Concurrent overselling must be blocked");

  const multiRideAfter = await storage.getRide(multiSeatRide.id);
  assert.strictEqual(multiRideAfter?.availableSeats, 0);
  assert.strictEqual(multiRideAfter?.status, "full");
  console.log("✅ Test 1b Passed: Multi-seat atomic reservation prevents overselling");

  // Test 1c: Transactional Cancellation & Seat Release
  const acceptedReqId = multiSuccesses[0].request!.id;
  const cancelResult = await storage.cancelRideRequestAtomic(acceptedReqId, passenger1.id);

  assert.strictEqual(cancelResult.success, true, "Cancellation must succeed");
  assert.strictEqual(cancelResult.request?.status, "cancelled");

  const rideAfterCancel = await storage.getRide(multiSeatRide.id);
  assert.strictEqual(rideAfterCancel?.availableSeats, 2, "Cancelled 2-seat booking must restore 2 seats to the ride");
  assert.strictEqual(rideAfterCancel?.status, "active", "Full ride status must revert to active upon cancellation");
  console.log("✅ Test 1c Passed: Transactional cancellation restores seats and reverts full status");

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
    academicYear: "Senior",
    major: "Math",
    gender: "Female",
    isVerified: true,
    rating: 4.9,
    totalRides: 15,
    cancellationCount: 0,
    completedRidesCount: 15,
    trustScore: 95,
    homeAirport: null,
    housingZone: null,
    createdAt: new Date(),
  };

  const mockRide: Ride = {
    id: "ride-1",
    driverId: mockDriver.id,
    origin: "Campus Library",
    destination: "SJC Airport",
    originLat: null,
    originLng: null,
    destLat: null,
    destLng: null,
    routePolyline: null,
    estimatedDurationMins: 45,
    distanceKm: 30,
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

  assert.ok(breakdown.totalScore >= 70, "Matching score should be high for matching origin/destination/time/gender");
  assert.ok(breakdown.reasons.length > 0, "Match breakdown should include human-readable match reasons");
  console.log("✅ Test 3 Passed: Multi-Factor Smart Match engine calculations verified");

  // Test 4: Geospatial Route Overlap & Detour Calculation
  const { calculateRouteOverlap, resolveCoordinates } = await import("../services/geospatial.service");
  const driverOrig = resolveCoordinates("Hostel A");
  const driverDest = resolveCoordinates("Chandigarh Railway Station");
  const passOrig = resolveCoordinates("Academic Block 1");
  const passDest = resolveCoordinates("Chandigarh Railway Station");

  const spatialMatch = calculateRouteOverlap(driverOrig, driverDest, passOrig, passDest);
  assert.ok(spatialMatch.overlapPercentage >= 75, "Campus to Railway station routes should have high overlap %");
  assert.ok(spatialMatch.detourKm < 3.0, "Pickup detour distance should be minimal");
  console.log("✅ Test 4 Passed: Spatial route overlap & detour math verified");

  // Test 5: SQL/Storage Pagination and Search Filter
  await storage.createRide({
    driverId: driver.id,
    origin: "Campus Main Hub",
    destination: "Airport Terminal 3",
    date: "2026-10-25",
    time: "11:00",
    availableSeats: 3,
    costPerPerson: 18,
  });

  const searchRes = await storage.searchRides({
    origin: "Campus",
    page: 1,
    limit: 10,
  });
  assert.ok(searchRes.items.length >= 1, "Search should return items matching origin");
  assert.ok(searchRes.total >= 1, "Total count should be populated");
  assert.strictEqual(searchRes.page, 1, "Current page should be 1");
  assert.strictEqual(searchRes.items[0].origin, "Campus Main Hub");
  assert.ok(searchRes.items[0].driver !== null, "Driver details should be attached");
  console.log("✅ Test 5 Passed: Search rides pagination and filtering verified");

  // Test 6: Telemetry Event Logging
  const eventPayload = await storage.createRideEvent({
    eventType: "VIEW_RIDE",
    userId: driver.id,
    rideId: ride.id,
    metadata: JSON.stringify({ source: "unit_test" }),
  });
  assert.ok(eventPayload.id, "Ride telemetry event should be created with unique ID");
  assert.strictEqual(eventPayload.eventType, "VIEW_RIDE");
  const userEvents = await storage.getRideEventsByUser(driver.id);
  assert.strictEqual(userEvents.length, 1, "User telemetry event history should contain 1 event");
  console.log("✅ Test 6 Passed: Telemetry event stream logging verified");

  console.log("🎉 All concurrency, multi-seat reservation, cancellation, search & matching tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
