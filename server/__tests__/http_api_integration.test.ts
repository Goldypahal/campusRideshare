import assert from "node:assert";
import express from "express";
import { registerRoutes } from "../routes";
import { type Server } from "http";

async function runHttpApiIntegrationTests() {
  console.log("🧪 Running CampusRideshare HTTP API Integration & Authorization Tests...");

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  const server: Server = await registerRoutes(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // ----------------------------------------------------
    // 1. User Registration & Institutional Authentication
    // ----------------------------------------------------
    console.log("  [1] Testing Registration & Institutional Email Policy...");

    // Non-institutional email should be rejected (400)
    const rejectRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Fake Student",
        email: "fake@gmail.com",
        password: "securepassword123",
        academicYear: "Freshman",
        major: "Computer Science",
        gender: "Male",
      }),
    });
    assert.strictEqual(rejectRes.status, 400, "Non-institutional email must be rejected by auth endpoint");

    // Register Student Driver
    const driverRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Driver Alice",
        email: "alice@campus.edu",
        password: "securepassword123",
        academicYear: "Senior",
        major: "Engineering",
        gender: "Female",
        role: "student",
      }),
    });
    assert.strictEqual(driverRes.status, 201, "Driver registration must succeed");
    const driverData = await driverRes.json();
    const driverToken = driverData.token;
    const driverUser = driverData.user;
    assert.ok(driverToken, "Registration must return JWT token");
    assert.strictEqual(driverUser.role, "student", "Driver role must be student");

    // Register Student Passenger 1
    const p1Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Passenger Bob",
        email: "bob@campus.edu",
        password: "securepassword123",
        academicYear: "Junior",
        major: "Biology",
        gender: "Male",
        role: "student",
      }),
    });
    assert.strictEqual(p1Res.status, 201);
    const p1Data = await p1Res.json();
    const p1Token = p1Data.token;
    const p1User = p1Data.user;

    // Register Student Passenger 2
    const p2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Passenger Carol",
        email: "carol@campus.edu",
        password: "securepassword123",
        academicYear: "Sophomore",
        major: "Chemistry",
        gender: "Female",
        role: "student",
      }),
    });
    assert.strictEqual(p2Res.status, 201);
    const p2Data = await p2Res.json();
    const p2Token = p2Data.token;
    const p2User = p2Data.user;

    // Register Campus Safety Responder
    const respRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Officer Dave",
        email: "dave@campus.edu",
        password: "securepassword123",
        academicYear: "Senior",
        major: "Campus Safety",
        gender: "Male",
        role: "responder",
      }),
    });
    assert.strictEqual(respRes.status, 201);
    const respData = await respRes.json();
    const respToken = respData.token;
    assert.strictEqual(respData.user.role, "responder", "Officer role must be responder");

    // Unauthenticated request rejection (401)
    const unauthRes = await fetch(`${baseUrl}/api/safety/incidents/active`);
    assert.strictEqual(unauthRes.status, 401, "Unauthenticated request must return 401 Unauthorized");
    console.log("  ✅ Passed: Registration, token issuance and unauthenticated protection verified.");

    // ----------------------------------------------------
    // 2. Safety Incident Authorization & Role Enforcement
    // ----------------------------------------------------
    console.log("  [2] Testing Safety Incident Role-Based Authorization & Transitions...");

    // Student Bob creates an emergency SOS incident
    const createIncidentRes = await fetch(`${baseUrl}/api/safety/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p1Token}`,
      },
      body: JSON.stringify({
        message: "Need urgent assistance near North Parking Lot",
        latitude: 37.7749,
        longitude: -122.4194,
        severity: "critical",
      }),
    });
    assert.strictEqual(createIncidentRes.status, 201, "Student can trigger SOS");
    const incidentData = await createIncidentRes.json();
    assert.ok(incidentData.ok, "SOS creation response ok");
    const incidentId = incidentData.incident.id;
    assert.strictEqual(incidentData.deliveryStatus, "persisted_queued_for_responders", "Accurately reports queued when no responders connected");

    // Ordinary student Carol attempts to view active emergency incidents dashboard -> 403 Forbidden
    const studentActiveRes = await fetch(`${baseUrl}/api/safety/incidents/active`, {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    assert.strictEqual(studentActiveRes.status, 403, "Ordinary students must be forbidden from active incidents feed");

    // Authorized responder Dave views active emergency incidents dashboard -> 200 OK
    const responderActiveRes = await fetch(`${baseUrl}/api/safety/incidents/active`, {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderActiveRes.status, 200, "Responders must have access to active incident feed");
    const activeList = await responderActiveRes.json();
    assert.ok(activeList.some((i: any) => i.id === incidentId), "Created incident appears in active monitor feed");

    // Uninvolved student Carol attempts to read incident details -> 403 Forbidden
    const carolIncidentRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${p2Token}` },
    });
    assert.strictEqual(carolIncidentRes.status, 403, "Uninvolved students must not view other students' incident details");

    // Incident creator Bob reads his own incident -> 200 OK
    const bobIncidentRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}`, {
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    assert.strictEqual(bobIncidentRes.status, 200, "Incident creator can read incident details");

    // Student attempts to acknowledge incident -> 403 Forbidden
    const studentAckRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${p1Token}` },
    });
    assert.strictEqual(studentAckRes.status, 403, "Ordinary students cannot acknowledge incidents");

    // Authorized responder acknowledges incident -> 200 OK
    const responderAckRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderAckRes.status, 200, "Authorized responder can acknowledge incident");
    const ackData = await responderAckRes.json();
    assert.strictEqual(ackData.status, "acknowledged", "Status transitioned to acknowledged");

    // Attempting to re-acknowledge already acknowledged incident -> 400 Bad Request
    const reAckRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}/acknowledge`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(reAckRes.status, 400, "Cannot acknowledge incident that is not active");

    // Authorized responder resolves incident -> 200 OK
    const responderResolveRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(responderResolveRes.status, 200, "Authorized responder can resolve incident");
    const resolvedData = await responderResolveRes.json();
    assert.strictEqual(resolvedData.status, "resolved", "Status transitioned to resolved");

    // Attempting to resolve already resolved incident -> 400 Bad Request
    const reResolveRes = await fetch(`${baseUrl}/api/safety/incidents/${incidentId}/resolve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(reResolveRes.status, 400, "Cannot re-resolve an already resolved incident");
    console.log("  ✅ Passed: Responder roles, active monitor restrictions & state transitions verified.");

    // ----------------------------------------------------
    // 3. Ride Booking Concurrency & Atomic Seat Lifecycle
    // ----------------------------------------------------
    console.log("  [3] Testing Ride Booking Atomic Acceptance, Overselling Protection & Cancellation...");

    // Driver Alice offers a ride with 2 available seats
    const createRideRes = await fetch(`${baseUrl}/api/rides`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        origin: "Campus Quad",
        destination: "Metro Center",
        date: "2026-11-15",
        time: "14:00",
        availableSeats: 2,
        costPerPerson: 8,
      }),
    });
    assert.strictEqual(createRideRes.status, 201, "Driver can create ride");
    const ride = await createRideRes.json();
    const rideId = ride.id;

    // Passenger Bob requests 1 seat
    const req1Res = await fetch(`${baseUrl}/api/ride-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p1Token}`,
      },
      body: JSON.stringify({
        rideId,
        seatsRequested: 1,
      }),
    });
    assert.strictEqual(req1Res.status, 201, "Passenger 1 can create request");
    const req1 = await req1Res.json();

    // Passenger Carol requests 2 seats
    const req2Res = await fetch(`${baseUrl}/api/ride-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({
        rideId,
        seatsRequested: 2,
      }),
    });
    assert.strictEqual(req2Res.status, 201, "Passenger 2 can create request");
    const req2 = await req2Res.json();

    // Driver Alice accepts Passenger 1 (1 seat reserved, 1 seat remaining)
    const accept1Res = await fetch(`${baseUrl}/api/ride-requests/${req1.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.strictEqual(accept1Res.status, 200, "Driver accepts Passenger 1");

    // Driver Alice tries to accept Passenger 2 (requested 2 seats, only 1 available) -> 400 Bad Request
    const accept2Res = await fetch(`${baseUrl}/api/ride-requests/${req2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.strictEqual(accept2Res.status, 400, "Accepting request exceeding remaining capacity must fail");

    // Passenger Bob cancels his accepted request -> seats must be restored to 2
    const cancel1Res = await fetch(`${baseUrl}/api/ride-requests/${req1.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p1Token}`,
      },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert.strictEqual(cancel1Res.status, 200, "Passenger 1 can cancel request");

    // Driver Alice can now accept Passenger 2 because 2 seats were restored!
    const accept2RetryRes = await fetch(`${baseUrl}/api/ride-requests/${req2.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: "accepted" }),
    });
    assert.strictEqual(accept2RetryRes.status, 200, "Passenger 2 can now be accepted after seats restored");

    // Verify ride is now marked full (0 seats available)
    const updatedRideRes = await fetch(`${baseUrl}/api/rides/${rideId}`, {
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
    const messageRes = await fetch(`${baseUrl}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({
        toUserId: driverUser.id,
        rideId,
        content: "Hi Alice, where will you be waiting?",
      }),
    });
    assert.strictEqual(messageRes.status, 201, "Confirmed co-riders can message each other");

    // Officer Dave (stranger with no booking on this ride) attempts to message Driver Alice -> 403 Forbidden
    const strangerMsgRes = await fetch(`${baseUrl}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${respToken}`,
      },
      body: JSON.stringify({
        toUserId: driverUser.id,
        rideId,
        content: "Hello stranger",
      }),
    });
    assert.strictEqual(strangerMsgRes.status, 403, "Non-participants cannot message users without a common ride");

    // Stranger Dave attempts to read Alice's message history -> 403 Forbidden
    const strangerHistoryRes = await fetch(`${baseUrl}/api/messages/${driverUser.id}?rideId=${rideId}`, {
      headers: { Authorization: `Bearer ${respToken}` },
    });
    assert.strictEqual(strangerHistoryRes.status, 403, "Non-participants cannot read conversation history");
    console.log("  ✅ Passed: Server-side common-ride messaging authorization enforced over HTTP.");

    // ----------------------------------------------------
    // 5. Ratings Eligibility & Duplicate Prevention
    // ----------------------------------------------------
    console.log("  [5] Testing Ratings Eligibility Rules & Duplicate Review Prevention...");

    // Attempting to rate on a non-completed ride -> 400 Bad Request
    const earlyRateRes = await fetch(`${baseUrl}/api/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({
        rideId,
        toUserId: driverUser.id,
        rating: 5,
        comment: "Great driver!",
      }),
    });
    assert.strictEqual(earlyRateRes.status, 400, "Cannot rate rides that are not completed");

    // Mark ride completed
    const completeRideRes = await fetch(`${baseUrl}/api/rides/${rideId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ status: "completed" }),
    });
    assert.strictEqual(completeRideRes.status, 200, "Driver marks ride completed");

    // Passenger Carol rates Driver Alice -> 201 Created
    const validRateRes = await fetch(`${baseUrl}/api/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({
        rideId,
        toUserId: driverUser.id,
        rating: 5,
        comment: "Great and punctual driver!",
      }),
    });
    assert.strictEqual(validRateRes.status, 201, "Confirmed passenger can rate driver after completion");

    // Passenger Carol attempts duplicate review for same ride -> 400 Bad Request
    const duplicateRateRes = await fetch(`${baseUrl}/api/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p2Token}`,
      },
      body: JSON.stringify({
        rideId,
        toUserId: driverUser.id,
        rating: 4,
        comment: "Duplicate attempt",
      }),
    });
    assert.strictEqual(duplicateRateRes.status, 400, "Duplicate ratings on same ride must be blocked");

    // Stranger Dave attempts to rate Driver Alice -> 403 Forbidden
    const strangerRateRes = await fetch(`${baseUrl}/api/ratings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${respToken}`,
      },
      body: JSON.stringify({
        rideId,
        toUserId: driverUser.id,
        rating: 1,
        comment: "I wasn't in this ride",
      }),
    });
    assert.strictEqual(strangerRateRes.status, 403, "Non-participants cannot submit ratings");
    console.log("  ✅ Passed: Rating completion requirements, co-participant checks & duplicate prevention verified.");

    console.log("\n🎉 All CampusRideshare HTTP API Integration & Authorization Tests passed successfully!\n");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
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
