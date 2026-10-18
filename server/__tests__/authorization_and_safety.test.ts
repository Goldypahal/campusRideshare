import assert from "node:assert";
import { MemStorage } from "../storage";

async function runAuthSafetyTests() {
  console.log("🧪 Running Authorization, Rating Business Rules & Durable Safety Tests...");

  const storage = new MemStorage();

  // Create test users
  const driver = await storage.createUser({
    fullName: "Driver Maya",
    email: "maya@campus.edu",
    password: "hashedpassword123",
    academicYear: "Senior",
    major: "Mechanical Engineering",
    gender: "Female",
  });

  const passenger = await storage.createUser({
    fullName: "Passenger Liam",
    email: "liam@campus.edu",
    password: "hashedpassword123",
    academicYear: "Junior",
    major: "Physics",
    gender: "Male",
  });

  const stranger = await storage.createUser({
    fullName: "Stranger Zoe",
    email: "zoe@campus.edu",
    password: "hashedpassword123",
    academicYear: "Freshman",
    major: "History",
    gender: "Female",
  });

  // -------------------- 1. Communication Authorization --------------------
  // Unrelated users cannot communicate
  const canChatInitially = await storage.canUsersCommunicate(driver.id, stranger.id);
  assert.strictEqual(canChatInitially, false, "Strangers with no common ride must not be authorized to chat");

  const canChatSelf = await storage.canUsersCommunicate(driver.id, driver.id);
  assert.strictEqual(canChatSelf, false, "Self-messaging must be prohibited");

  // Create ride
  const ride = await storage.createRide({
    driverId: driver.id,
    origin: "Library",
    destination: "Train Station",
    date: "2026-11-01",
    time: "15:00",
    availableSeats: 3,
    costPerPerson: 10,
  });

  // Passenger requests a seat
  const req = await storage.createRideRequest({
    rideId: ride.id,
    passengerId: passenger.id,
    seatsRequested: 1,
  });

  // Now driver and requester can communicate
  const canChatAfterRequest = await storage.canUsersCommunicate(driver.id, passenger.id, ride.id);
  assert.strictEqual(canChatAfterRequest, true, "Driver and pending/accepted requester must be authorized to communicate");

  // Stranger still cannot message either of them
  const canStrangerChat = await storage.canUsersCommunicate(stranger.id, driver.id, ride.id);
  assert.strictEqual(canStrangerChat, false, "Third parties must still be blocked from the ride chat");
  console.log("✅ Test 1 Passed: Server-side message authorization enforced");

  // -------------------- 2. Rating Eligibility & Trust Score Rules --------------------
  // Attempt 1: Rate an active (not completed) ride -> Must fail
  const prematureRating = await storage.createRatingEligible({
    rideId: ride.id,
    fromUserId: passenger.id,
    toUserId: driver.id,
    rating: 5,
    comment: "Great ride",
  });
  assert.strictEqual(prematureRating.success, false, "Rating before ride completion must be rejected");
  assert.ok(prematureRating.error?.includes("completed"), "Error message should mention ride completion requirement");

  // Accept request and mark ride completed
  await storage.acceptRideRequestAtomic(req.id, driver.id);
  await storage.updateRide(ride.id, { status: "completed" });

  // Attempt 2: Stranger attempts to rate -> Must fail
  const strangerRating = await storage.createRatingEligible({
    rideId: ride.id,
    fromUserId: stranger.id,
    toUserId: driver.id,
    rating: 1,
    comment: "Was not even there",
  });
  assert.strictEqual(strangerRating.success, false, "Non-participant review must be rejected");

  // Attempt 3: Valid passenger rates driver -> Must succeed
  const validRating = await storage.createRatingEligible({
    rideId: ride.id,
    fromUserId: passenger.id,
    toUserId: driver.id,
    rating: 5,
    comment: "On time and safe driving!",
  });
  assert.strictEqual(validRating.success, true, "Valid participant rating must succeed");

  // Check driver's updated trust score and rating
  const updatedDriver = await storage.getUser(driver.id);
  assert.strictEqual(updatedDriver?.rating, 5.0, "Driver rating should be updated to 5.0");
  assert.strictEqual(updatedDriver?.totalRides, 1, "Driver total rides should increment to 1");

  // Attempt 4: Duplicate rating for same ride -> Must fail
  const duplicateRating = await storage.createRatingEligible({
    rideId: ride.id,
    fromUserId: passenger.id,
    toUserId: driver.id,
    rating: 4,
    comment: "Trying to submit a second review",
  });
  assert.strictEqual(duplicateRating.success, false, "Duplicate review for the same ride must be rejected");
  console.log("✅ Test 2 Passed: Rating eligibility, co-participant verification & duplicate review prevention enforced");

  // -------------------- 3. Durable Safety Incidents Lifecycle --------------------
  const incident = await storage.createSafetyIncident({
    userId: passenger.id,
    rideId: ride.id,
    latitude: 28.7041,
    longitude: 77.1025,
    message: "Vehicle stopped unexpectedly off-route",
    severity: "critical",
    status: "active",
  });
  assert.ok(incident.id, "Safety incident must be assigned an ID");
  assert.strictEqual(incident.status, "active");

  const activeIncidents = await storage.listActiveIncidents();
  assert.strictEqual(activeIncidents.length, 1, "Should list 1 active incident");

  // Acknowledge incident
  const acknowledged = await storage.updateSafetyIncident(incident.id, {
    status: "acknowledged",
    acknowledgedBy: driver.id,
    acknowledgedAt: new Date(),
  });
  assert.strictEqual(acknowledged?.status, "acknowledged");

  // Resolve incident
  const resolved = await storage.updateSafetyIncident(incident.id, {
    status: "resolved",
    resolvedAt: new Date(),
  });
  assert.strictEqual(resolved?.status, "resolved");

  const activeAfterResolve = await storage.listActiveIncidents();
  assert.strictEqual(activeAfterResolve.length, 0, "No active incidents should remain after resolution");
  console.log("✅ Test 3 Passed: Durable safety incident persistence, acknowledgement & resolution verified");

  // -------------------- 4. Email Verification Token Lifecycle --------------------
  const tokenRecord = await storage.createVerificationToken({
    userId: stranger.id,
    token: "secure-verification-token-xyz789",
    type: "email_verification",
    expiresAt: new Date(Date.now() + 86400000),
  });
  assert.ok(tokenRecord.id);

  const foundToken = await storage.getVerificationToken("secure-verification-token-xyz789");
  assert.ok(foundToken);
  assert.strictEqual(foundToken?.userId, stranger.id);
  assert.strictEqual(foundToken?.usedAt, null);

  await storage.markTokenUsed(foundToken!.id);
  const updatedToken = await storage.getVerificationToken("secure-verification-token-xyz789");
  assert.ok(updatedToken?.usedAt !== null, "Token must be marked used");
  console.log("✅ Test 4 Passed: Verification token generation and single-use lifecycle verified");

  console.log("🎉 All authorization, rating business rules & safety incident tests passed successfully!");
}

runAuthSafetyTests().catch((err) => {
  console.error("❌ Auth & Safety tests failed:", err);
  process.exit(1);
});
