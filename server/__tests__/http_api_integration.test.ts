import assert from "node:assert";
import express from "express";
import { registerRoutes } from "../routes";
import { createTestClient } from "./test_client";
import { emailService } from "../services/email.service";
import { storage } from "../storage";
import jwt from "jsonwebtoken";
import { env } from "../env";

async function runHttpApiIntegrationTests() {
  console.log("🧪 Running CampusRideshare HTTP API Integration & Security Regression Tests...");

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(app);
  const testFetch = createTestClient(app);

  try {
    // ----------------------------------------------------
    // 1. User Registration & Institutional Authentication (Finding 1 & 2)
    // ----------------------------------------------------
    console.log("  [1] Testing Registration, Email Verification & Role Security...");

    // Non-institutional email should be rejected (400)
    const rejectRes = await testFetch("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Fake Student",
        email: "fake@gmail.com",
        password: "securepassword123",
        academicYear: "Freshman",
        major: "Computer Science",
        gender: "Male",
      },
    });
    assert.strictEqual(rejectRes.status, 400, "Non-institutional email must be rejected by auth endpoint");

    // Register Student Driver Alice
    const driverRes = await testFetch("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Driver Alice",
        email: "alice@campus.edu",
        password: "securepassword123",
        academicYear: "Senior",
        major: "Engineering",
        gender: "Female",
      },
    });
    assert.strictEqual(driverRes.status, 201, "Driver registration must succeed");
    const driverData = await driverRes.json();
    let driverToken = driverData.token;
    const driverUser = driverData.user;
    assert.ok(driverToken, "Registration must return JWT token");
    assert.strictEqual(driverUser.role, "student", "Driver role must default to student");
    // Verify Finding 2: Token is NOT returned in response
    assert.strictEqual(driverData.verification?.token, undefined, "Verification token must not be leaked in JSON response");
    assert.strictEqual(driverData.verification?.sent, true, "Verification dispatch status must be confirmed");

    // Verify email dispatch captured token
    const aliceEmail = emailService.getRecentSentEmail("alice@campus.edu");
    assert.ok(aliceEmail, "Verification email must be sent to driver");
    assert.ok(aliceEmail.rawToken, "Email record contains raw token");

    // Verify unverified driver CANNOT create rides yet (Finding 5)
    const earlyRideRes = await testFetch("/api/rides", {
      method: "POST",
      headers: { Authorization: `Bearer ${driverToken}` },
      body: {
        origin: "Campus Quad",
        destination: "Metro Center",
        date: "2026-11-15",
        time: "14:00",
        availableSeats: 2,
        costPerPerson: 8,
      },
    });
    assert.strictEqual(earlyRideRes.status, 403, "Unverified user must be blocked from offering rides");

    // Verify Alice's email
    const verifyAliceRes = await testFetch("/api/auth/verify-email", {
      method: "POST",
      body: { token: aliceEmail.rawToken },
    });
    assert.strictEqual(verifyAliceRes.status, 200, "Email verification must succeed");
    const verifiedAliceData = await verifyAliceRes.json();
    assert.strictEqual(verifiedAliceData.user?.isVerified, true, "User must be marked verified");

    // Register Student Passenger Bob
    const p1Res = await testFetch("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Passenger Bob",
        email: "bob@campus.edu",
        password: "securepassword123",
        academicYear: "Junior",
        major: "Biology",
        gender: "Male",
      },
    });
    assert.strictEqual(p1Res.status, 201);
    const p1Data = await p1Res.json();
    const p1Token = p1Data.token;
    const p1Email = emailService.getRecentSentEmail("bob@campus.edu");
    await testFetch("/api/auth/verify-email", { method: "POST", body: { token: p1Email!.rawToken } });

    // Register Student Passenger Carol
    const p2Res = await testFetch("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Passenger Carol",
        email: "carol@campus.edu",
        password: "securepassword123",
        academicYear: "Sophomore",
        major: "Chemistry",
        gender: "Female",
      },
    });
    assert.strictEqual(p2Res.status, 201);
    const p2Data = await p2Res.json();
    const p2Token = p2Data.token;
    const p2Email = emailService.getRecentSentEmail("carol@campus.edu");
    await testFetch("/api/auth/verify-email", { method: "POST", body: { token: p2Email!.rawToken } });

    // Register Officer Dave - attempting privilege escalation by requesting role: "responder" (Finding 1)
    const respRes = await testFetch("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Officer Dave",
        email: "dave@campus.edu",
        password: "securepassword123",
        academicYear: "Senior",
        major: "Campus Safety",
        gender: "Male",
        role: "responder", // Attacker attempts to become responder via registration
      },
    });
    assert.strictEqual(respRes.status, 201);
    const respData = await respRes.json();
    let respToken = respData.token;
    // Finding 1 Verification: Role is forced to "student"
    assert.strictEqual(respData.user.role, "student", "Public registration must force role to student, ignoring injection");

    // Dave cannot access responder active incidents feed as a student
    const daveUnauthorizedActive = await testFetch("/api/safety/incidents/active", {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(daveUnauthorizedActive.status, 403, "Student Dave must be denied access to responder monitor");

    // Setup an Admin user to grant role securely
    const adminUser = await storage.createUser({
      fullName: "Campus Administrator",
      email: "admin@campus.edu",
      password: "hashedadminpassword",
      academicYear: "Senior",
      major: "Administration",
      gender: "Non-binary",
    });
    await storage.updateUser(adminUser.id, { role: "admin", isVerified: true });
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Admin promotes Dave to "responder" via audited endpoint (Finding 1)
    const promoteRes = await testFetch(`/api/admin/users/${respData.user.id}/roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        role: "responder",
        reason: "Verified campus safety officer credentials with ID badge #CS-409",
      },
    });
    assert.strictEqual(promoteRes.status, 200, "Admin can promote user role");
    const promoteData = await promoteRes.json();
    assert.strictEqual(promoteData.user.role, "responder", "Role successfully promoted to responder");
    assert.ok(promoteData.auditLogId, "Audit log ID generated for role change");

    // Re-issue Dave's token with updated role
    respToken = jwt.sign(
      { id: respData.user.id, email: "dave@campus.edu", role: "responder" },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log("  ✅ Passed: Registration, email verification, privilege escalation prevention & role audit verified.");

    // ----------------------------------------------------
    // 2. Safety Incident Authorization & Role Enforcement
    // ----------------------------------------------------
    console.log("  [2] Testing Safety Incident Role-Based Authorization & Transitions...");

    // Student Bob creates an emergency SOS incident
    const createIncidentRes = await testFetch("/api/safety/incidents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p1Token}`,
      },
      body: {
        message: "Need urgent assistance near North Parking Lot",
        latitude: 37.7749,
        longitude: -122.4194,
        severity: "critical",
      },
    });
    assert.strictEqual(createIncidentRes.status, 201, "Student can trigger SOS");
    const incidentData = await createIncidentRes.json();
    assert.ok(incidentData.ok, "SOS creation response ok");
    const incidentId = incidentData.incident.id;
    assert.strictEqual(
      incidentData.deliveryStatus,
      "persisted_queued_for_responders",
      "Accurately reports queued when no responders connected"
    );

    // Ordinary student Carol attempts to view active emergency incidents dashboard -> 403 Forbidden
    const studentActiveRes = await testFetch("/api/safety/incidents/active", {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    assert.strictEqual(studentActiveRes.status, 403, "Ordinary students must be forbidden from active incidents feed");

    // Authorized responder Dave views active emergency incidents dashboard -> 200 OK
    const responderActiveRes = await testFetch("/api/safety/incidents/active", {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderActiveRes.status, 200, "Responders must have access to active incident feed");
    const activeList = await responderActiveRes.json();
    assert.ok(activeList.some((i: any) => i.id === incidentId), "Created incident appears in active monitor feed");

    // Uninvolved student Carol attempts to read incident details -> 403 Forbidden
    const carolIncidentRes = await testFetch(`/api/safety/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    assert.strictEqual(carolIncidentRes.status, 403, "Uninvolved students must not view other students' incident details");

    // Incident creator Bob reads his own incident -> 200 OK
    const bobIncidentRes = await testFetch(`/api/safety/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    assert.strictEqual(bobIncidentRes.status, 200, "Incident creator can read incident details");

    // Student attempts to acknowledge incident -> 403 Forbidden
    const studentAckRes = await testFetch(`/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    assert.strictEqual(studentAckRes.status, 403, "Ordinary students cannot acknowledge incidents");

    // Authorized responder acknowledges incident -> 200 OK
    const responderAckRes = await testFetch(`/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderAckRes.status, 200, "Authorized responder can acknowledge incident");
    const ackData = await responderAckRes.json();
    assert.strictEqual(ackData.status, "acknowledged", "Status transitioned to acknowledged");

    // Attempting to re-acknowledge already acknowledged incident -> 400 Bad Request
    const reAckRes = await testFetch(`/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(reAckRes.status, 400, "Cannot acknowledge incident that is not active");

    // Authorized responder resolves incident -> 200 OK
    const responderResolveRes = await testFetch(`/api/safety/incidents/${incidentId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderResolveRes.status, 200, "Authorized responder can resolve incident");
    const resolvedData = await responderResolveRes.json();
    assert.strictEqual(resolvedData.status, "resolved", "Status transitioned to resolved");

    console.log("  ✅ Passed: Responder roles, active monitor restrictions & state transitions verified.");

    // ----------------------------------------------------
    // 3. Ride Booking Concurrency & Atomic Seat Lifecycle
    // ----------------------------------------------------
    console.log("  [3] Testing Ride Booking Atomic Acceptance, Overselling Protection & Cancellation...");

    // Driver Alice offers a ride with 2 available seats
    const createRideRes = await testFetch("/api/rides", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: {
        origin: "Campus Quad",
        destination: "Metro Center",
        date: "2026-11-15",
        time: "14:00",
        availableSeats: 2,
        costPerPerson: 8,
      },
    });
    assert.strictEqual(createRideRes.status, 201, "Driver can create ride");
    const ride = await createRideRes.json();
    const rideId = ride.id;

    // Passenger Bob requests 1 seat
    const req1Res = await testFetch("/api/ride-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p1Token}`,
      },
      body: {
        rideId,
        seatsRequested: 1,
      },
    });
    assert.strictEqual(req1Res.status, 201, "Passenger 1 can create request");
    const req1 = await req1Res.json();

    // Passenger Carol requests 2 seats
    const req2Res = await testFetch("/api/ride-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p2Token}`,
      },
      body: {
        rideId,
        seatsRequested: 2,
      },
    });
    assert.strictEqual(req2Res.status, 201, "Passenger 2 can create request");
    const req2 = await req2Res.json();

    // Driver Alice accepts Passenger 1 (1 seat reserved, 1 seat remaining)
    const accept1Res = await testFetch(`/api/ride-requests/${req1.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: { status: "accepted" },
    });
    assert.strictEqual(accept1Res.status, 200, "Driver accepts Passenger 1");

    // Driver Alice tries to accept Passenger 2 (requested 2 seats, only 1 available) -> 400 Bad Request
    const accept2Res = await testFetch(`/api/ride-requests/${req2.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: { status: "accepted" },
    });
    assert.strictEqual(accept2Res.status, 400, "Accepting request exceeding remaining capacity must fail");

    // Passenger Bob cancels his accepted request -> seats must be restored to 2
    const cancel1Res = await testFetch(`/api/ride-requests/${req1.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${p1Token}`,
      },
      body: { status: "cancelled" },
    });
    assert.strictEqual(cancel1Res.status, 200, "Passenger 1 can cancel request");

    // Driver Alice can now accept Passenger 2 because 2 seats were restored!
    const accept2RetryRes = await testFetch(`/api/ride-requests/${req2.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: { status: "accepted" },
    });
    assert.strictEqual(accept2RetryRes.status, 200, "Passenger 2 can now be accepted after seats restored");

    // Verify ride is now marked full (0 seats available)
    const updatedRideRes = await testFetch(`/api/rides/${rideId}`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const updatedRide = await updatedRideRes.json();
    assert.strictEqual(updatedRide.availableSeats, 0, "Available seats must be exactly 0");
    assert.strictEqual(updatedRide.status, "full", "Ride status must update to full");
    console.log("  ✅ Passed: Atomic booking acceptance, overselling prevention & seat restoration verified.");

    // ----------------------------------------------------
    // 4. Common-Ride Messaging Authorization
    // ----------------------------------------------------
    console.log("  [4] Testing Common-Ride Messaging Authorization over HTTP...");

    // Confirmed passenger Carol can message Driver Alice
    const messageRes = await testFetch("/api/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p2Token}`,
      },
      body: {
        toUserId: driverUser.id,
        rideId,
        content: "Hi Alice, where will you be waiting?",
      },
    });
    assert.strictEqual(messageRes.status, 201, "Confirmed co-riders can message each other");

    // Officer Dave (stranger with no booking on this ride) attempts to message Driver Alice -> 403 Forbidden
    const strangerMsgRes = await testFetch("/api/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${respToken}`,
      },
      body: {
        toUserId: driverUser.id,
        rideId,
        content: "Hello stranger",
      },
    });
    assert.strictEqual(strangerMsgRes.status, 403, "Non-participants cannot message users without a common ride");

    console.log("  ✅ Passed: Server-side common-ride messaging authorization enforced over HTTP.");

    // ----------------------------------------------------
    // 5. Ratings Eligibility & Duplicate Prevention
    // ----------------------------------------------------
    console.log("  [5] Testing Ratings Eligibility Rules & Duplicate Review Prevention...");

    // Attempting to rate on a non-completed ride -> 400 Bad Request
    const earlyRateRes = await testFetch("/api/ratings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p2Token}`,
      },
      body: {
        rideId,
        toUserId: driverUser.id,
        rating: 5,
        comment: "Great driver!",
      },
    });
    assert.strictEqual(earlyRateRes.status, 400, "Cannot rate rides that are not completed");

    // Mark ride completed
    const completeRideRes = await testFetch(`/api/rides/${rideId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
      body: { status: "completed" },
    });
    assert.strictEqual(completeRideRes.status, 200, "Driver marks ride completed");

    // Passenger Carol rates Driver Alice -> 201 Created
    const validRateRes = await testFetch("/api/ratings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p2Token}`,
      },
      body: {
        rideId,
        toUserId: driverUser.id,
        rating: 5,
        comment: "Great and punctual driver!",
      },
    });
    assert.strictEqual(validRateRes.status, 201, "Confirmed passenger can rate driver after completion");

    // Passenger Carol attempts duplicate review for same ride -> 400 Bad Request
    const duplicateRateRes = await testFetch("/api/ratings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p2Token}`,
      },
      body: {
        rideId,
        toUserId: driverUser.id,
        rating: 4,
        comment: "Duplicate attempt",
      },
    });
    assert.strictEqual(duplicateRateRes.status, 400, "Duplicate ratings on same ride must be blocked");

    // Stranger Dave attempts to rate Driver Alice -> 403 Forbidden
    const strangerRateRes = await testFetch("/api/ratings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${respToken}`,
      },
      body: {
        rideId,
        toUserId: driverUser.id,
        rating: 1,
        comment: "I wasn't in this ride",
      },
    });
    assert.strictEqual(strangerRateRes.status, 403, "Non-participants cannot submit ratings");
    console.log("  ✅ Passed: Rating completion requirements, co-participant checks & duplicate prevention verified.");

    // ----------------------------------------------------
    // 6. User Stats, Profile Updates & WS Ticket Generation (Findings 6 & 9)
    // ----------------------------------------------------
    console.log("  [6] Testing User Stats, Profile API & WS Tickets...");

    // Test GET /api/users/:id/stats
    const statsRes = await testFetch(`/api/users/${driverUser.id}/stats`);
    assert.strictEqual(statsRes.status, 200, "Stats endpoint must succeed");
    const stats = await statsRes.json();
    assert.ok(stats.totalRides !== undefined, "Stats contains totalRides");
    assert.ok(stats.co2SavedKg !== undefined, "Stats contains co2SavedKg");
    assert.ok(stats.trustScore !== undefined, "Stats contains trustScore");

    // Test PATCH /api/users/me
    const profilePatchRes = await testFetch("/api/users/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${driverToken}` },
      body: {
        fullName: "Alice Wonderland",
        major: "Robotics Engineering",
      },
    });
    assert.strictEqual(profilePatchRes.status, 200, "PATCH /api/users/me must update profile");
    const updatedProfile = await profilePatchRes.json();
    assert.strictEqual(updatedProfile.fullName, "Alice Wonderland");
    assert.strictEqual(updatedProfile.major, "Robotics Engineering");

    // Test POST /api/auth/ws-ticket (One-time WS ticket generation)
    const ticketRes = await testFetch("/api/auth/ws-ticket", {
      method: "POST",
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert.strictEqual(ticketRes.status, 200, "WS ticket generation must succeed");
    const ticketData = await ticketRes.json();
    assert.ok(ticketData.ticket, "One-time ticket generated");
    assert.strictEqual(ticketData.expiresInSeconds, 30, "Ticket valid for 30s");

    console.log("\n🎉 All CampusRideshare HTTP API Integration & Security Regression Tests passed successfully!\n");
  } catch (err) {
    console.error("❌ Test assertion failure:", err);
    throw err;
  }
}

runHttpApiIntegrationTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ HTTP API Integration Test Failure:", err);
    process.exit(1);
  });
