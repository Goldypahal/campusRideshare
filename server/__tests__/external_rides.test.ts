import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import { registerRoutes } from "../routes";
import { createTestClient } from "./test_client";
import { storage } from "../storage";
import { env } from "../env";
import { lookupKnownPlace } from "../services/external-rides/landmarks";
import { uberProvider } from "../services/external-rides/uber.provider";

async function runExternalRidesTests() {
  console.log("🧪 Running External Ride-Hailing Fallback (Uber, Ola, Rapido) Tests...");

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(app);
  const testFetch = createTestClient(app);

  const jwtSecret = env.JWT_SECRET || "ci_test_jwt_secret_key_1234567890_abcdefgh";

  // Create a test user
  const user = await storage.createUser({
    fullName: "External Test Student",
    email: `ext_student_${Date.now()}@campus.edu`,
    password: "securepassword123",
    academicYear: "Junior",
    major: "Computer Science",
    gender: "Female",
  });

  const authToken = jwt.sign(
    { id: user.id, email: user.email, role: "student" },
    jwtSecret,
    { expiresIn: "1h" }
  );

  // Set test Uber Client ID
  env.UBER_CLIENT_ID = "test_uber_client_id_xyz123";

  try {
    // ------------------------------------------------------------------------
    // Test 10: lookupKnownPlace exact matching vs partial/unlisted
    // ------------------------------------------------------------------------
    console.log("  [Test 10] Testing landmark exact lookup (lookupKnownPlace)...");
    const hostelBCoords = lookupKnownPlace("Hostel B");
    assert.ok(hostelBCoords, "Exact match 'Hostel B' must resolve to coordinates");
    assert.strictEqual(hostelBCoords.lat, 30.76, "Hostel B latitude matches");
    assert.strictEqual(hostelBCoords.lng, 76.77, "Hostel B longitude matches");

    // Case-insensitivity & whitespace trimming
    const trimmedMatch = lookupKnownPlace("   hOsTeL b  ");
    assert.ok(trimmedMatch, "Case-insensitive and trimmed lookup must match");
    assert.strictEqual(trimmedMatch.lat, 30.76);

    // Partial strings must NOT resolve (must be undefined)
    const partialMatch = lookupKnownPlace("Hostel");
    assert.strictEqual(partialMatch, undefined, "Partial match 'Hostel' must return undefined");

    // Unlisted strings must NOT resolve
    const unknownMatch = lookupKnownPlace("random text");
    assert.strictEqual(unknownMatch, undefined, "Unlisted place 'random text' must return undefined");
    console.log("  ✅ Test 10 Passed: lookupKnownPlace strictly enforces exact matches without heuristic guessing.");

    // ------------------------------------------------------------------------
    // Test 1: Uber universal link builder (host, path, params, coordinates)
    // ------------------------------------------------------------------------
    console.log("  [Test 1] Testing Uber universal link builder with coordinates...");
    const handoffWithCoords = uberProvider.buildHandoff({
      pickup: { label: "Campus Main Gate", lat: 30.751, lng: 76.762, address: "Sector 14 Gate" },
      dropoff: { label: "Railway Station", lat: 30.7046, lng: 76.8242, address: "Chandigarh Junction" },
      platform: "web",
    });

    const parsedUrl = new URL(handoffWithCoords.url);
    assert.strictEqual(parsedUrl.host, "m.uber.com", "Host must be m.uber.com");
    assert.strictEqual(parsedUrl.pathname, "/ul/", "Pathname must be /ul/");
    assert.strictEqual(parsedUrl.searchParams.get("action"), "setPickup", "action must be setPickup");
    assert.strictEqual(parsedUrl.searchParams.get("client_id"), "test_uber_client_id_xyz123", "client_id must match");
    assert.strictEqual(parsedUrl.searchParams.get("pickup[latitude]"), "30.751", "Pickup latitude matches");
    assert.strictEqual(parsedUrl.searchParams.get("pickup[longitude]"), "76.762", "Pickup longitude matches");
    assert.strictEqual(parsedUrl.searchParams.get("pickup[nickname]"), "Campus Main Gate", "Pickup nickname matches");
    assert.strictEqual(parsedUrl.searchParams.get("pickup[formatted_address]"), "Sector 14 Gate", "Pickup address matches");
    assert.strictEqual(parsedUrl.searchParams.get("dropoff[latitude]"), "30.7046", "Dropoff latitude matches");
    assert.strictEqual(parsedUrl.searchParams.get("dropoff[longitude]"), "76.8242", "Dropoff longitude matches");
    assert.strictEqual(parsedUrl.searchParams.get("dropoff[nickname]"), "Railway Station", "Dropoff nickname matches");
    assert.strictEqual(handoffWithCoords.prefilled, true, "prefilled must be true when coordinates are present");
    console.log("  ✅ Test 1 Passed: Uber universal link built with correct host, path, params, and coordinates.");

    // ------------------------------------------------------------------------
    // Test 2: Uber link omits pickup/dropoff params when coordinates are missing
    // ------------------------------------------------------------------------
    console.log("  [Test 2] Testing coordinate omission when unverified...");
    const handoffOmitPickup = uberProvider.buildHandoff({
      pickup: { label: "Unknown Spot Without Coords" },
      dropoff: { label: "Railway Station", lat: 30.7046, lng: 76.8242 },
      platform: "web",
    });
    const parsedOmitPickup = new URL(handoffOmitPickup.url);
    assert.strictEqual(parsedOmitPickup.searchParams.get("pickup[latitude]"), null, "pickup[latitude] must be omitted");
    assert.strictEqual(parsedOmitPickup.searchParams.get("pickup[nickname]"), null, "pickup[nickname] must be omitted");
    assert.strictEqual(parsedOmitPickup.searchParams.get("dropoff[latitude]"), "30.7046", "dropoff coordinates retained");

    const handoffOmitBoth = uberProvider.buildHandoff({
      pickup: { label: "Pickup Without Coords" },
      dropoff: { label: "Dropoff Without Coords" },
      platform: "web",
    });
    const parsedOmitBoth = new URL(handoffOmitBoth.url);
    assert.strictEqual(parsedOmitBoth.searchParams.get("pickup[latitude]"), null);
    assert.strictEqual(parsedOmitBoth.searchParams.get("dropoff[latitude]"), null);
    assert.strictEqual(parsedOmitBoth.searchParams.get("action"), "setPickup");
    assert.strictEqual(handoffOmitBoth.prefilled, false, "prefilled must be false when no coordinates provided");
    console.log("  ✅ Test 2 Passed: Uber link correctly omits pickup/dropoff params when coordinates are absent.");

    // ------------------------------------------------------------------------
    // Test 3: product_id never appears
    // ------------------------------------------------------------------------
    console.log("  [Test 3] Verifying product_id is never sent in Stage 1...");
    assert.strictEqual(parsedUrl.searchParams.get("product_id"), null, "product_id must not be present");
    assert.strictEqual(parsedOmitPickup.searchParams.get("product_id"), null, "product_id must not be present");
    assert.ok(!handoffWithCoords.url.includes("product_id"), "URL does not contain product_id substring");
    console.log("  ✅ Test 3 Passed: product_id is strictly omitted from Stage 1 universal links.");

    // ------------------------------------------------------------------------
    // Test 7: Unauthenticated request -> 401
    // ------------------------------------------------------------------------
    console.log("  [Test 7] Testing authentication enforcement (401)...");
    const unauthProvidersRes = await testFetch("/api/external-rides/providers");
    assert.strictEqual(unauthProvidersRes.status, 401, "GET /providers requires authentication");

    const unauthHandoffRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      body: {
        providerId: "uber",
        pickup: { label: "Campus" },
        dropoff: { label: "Airport" },
      },
    });
    assert.strictEqual(unauthHandoffRes.status, 401, "POST /handoffs requires authentication");
    console.log("  ✅ Test 7 Passed: Unauthenticated requests are rejected with 401 Unauthorized.");

    // ------------------------------------------------------------------------
    // Test 4: Invalid latitude/longitude or empty label -> 400 problem+json
    // ------------------------------------------------------------------------
    console.log("  [Test 4] Testing Zod input validation (400 ProblemDetails)...");
    const invalidLatRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        providerId: "uber",
        pickup: { label: "Valid Pickup", lat: 150 }, // Out of range [-90, 90]
        dropoff: { label: "Valid Dropoff" },
      },
    });
    assert.strictEqual(invalidLatRes.status, 400, "Latitude > 90 must fail validation");
    const invalidLatProblem = await invalidLatRes.json();
    assert.strictEqual(invalidLatProblem.type, "urn:problem:validation-error");

    const emptyLabelRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        providerId: "uber",
        pickup: { label: "   " }, // Empty after trim
        dropoff: { label: "Valid Dropoff" },
      },
    });
    assert.strictEqual(emptyLabelRes.status, 400, "Empty label must fail validation");
    console.log("  ✅ Test 4 Passed: Out-of-bounds coordinates and empty labels return 400 ProblemDetails.");

    // ------------------------------------------------------------------------
    // Test 5: Uber hidden when UBER_CLIENT_ID is empty; handoff -> 404
    // ------------------------------------------------------------------------
    console.log("  [Test 5] Testing Uber client ID requirement & hiding...");
    const originalUberClientId = env.UBER_CLIENT_ID;
    env.UBER_CLIENT_ID = ""; // Clear client ID

    const providersWithoutUberRes = await testFetch("/api/external-rides/providers", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.strictEqual(providersWithoutUberRes.status, 200);
    const providersWithoutUber = await providersWithoutUberRes.json();
    assert.ok(
      !providersWithoutUber.providers.some((p: any) => p.id === "uber"),
      "Uber must be excluded from /providers when UBER_CLIENT_ID is empty"
    );

    const handoffDisabledUberRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        providerId: "uber",
        pickup: { label: "Campus" },
        dropoff: { label: "Airport" },
      },
    });
    assert.strictEqual(handoffDisabledUberRes.status, 404, "Handoff to hidden Uber must return 404");

    // Restore Uber Client ID
    env.UBER_CLIENT_ID = originalUberClientId;
    console.log("  ✅ Test 5 Passed: Uber is hidden from /providers and returns 404 when UBER_CLIENT_ID is missing.");

    // ------------------------------------------------------------------------
    // Test 6: Disabled provider (flag off) -> absent from /providers, 404 on handoff
    // ------------------------------------------------------------------------
    console.log("  [Test 6] Testing feature flags for disabled providers (Ola/Rapido)...");
    env.EXTERNAL_RIDES_OLA_ENABLED = false;
    const providersListRes = await testFetch("/api/external-rides/providers", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const providersList = await providersListRes.json();
    assert.ok(
      !providersList.providers.some((p: any) => p.id === "ola"),
      "Ola must be absent from /providers when EXTERNAL_RIDES_OLA_ENABLED is false"
    );

    const handoffDisabledOlaRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        providerId: "ola",
        pickup: { label: "Campus" },
        dropoff: { label: "Airport" },
      },
    });
    assert.strictEqual(handoffDisabledOlaRes.status, 404, "Handoff to disabled provider must return 404");
    console.log("  ✅ Test 6 Passed: Disabled providers are absent from list and return 404 on handoff.");

    // ------------------------------------------------------------------------
    // Test 8: Handoff creates audit row (no location data) & telemetry (no coords)
    // ------------------------------------------------------------------------
    console.log("  [Test 8] Testing handoff data minimization & telemetry...");
    const validHandoffRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        providerId: "uber",
        pickup: { label: "Hostel B" }, // Will resolve coords via lookupKnownPlace
        dropoff: { label: "Chandigarh Railway Station" }, // Will resolve coords
        platform: "web",
        context: { reason: "no_match" },
      },
    });
    assert.strictEqual(validHandoffRes.status, 201, "Handoff creation must succeed");
    const validHandoffData = await validHandoffRes.json();
    assert.ok(validHandoffData.handoffId, "Response contains handoffId");
    assert.ok(validHandoffData.url, "Response contains URL");
    assert.strictEqual(validHandoffData.prefilled, true, "Prefilled is true because coordinates resolved");
    assert.ok(validHandoffData.disclosure?.safety, "Safety disclosure present");
    assert.ok(validHandoffData.disclosure?.privacy, "Privacy disclosure present");

    // Inspect stored handoff row in storage
    const handoffs = await storage.getExternalRideHandoffsByUser(user.id);
    assert.strictEqual(handoffs.length, 1, "Exactly one handoff record persisted");
    const handoffRecord = handoffs[0];
    assert.strictEqual(handoffRecord.providerId, "uber");
    assert.strictEqual(handoffRecord.reason, "no_match");
    assert.strictEqual(handoffRecord.hadPickupCoords, true);
    assert.strictEqual(handoffRecord.hadDropoffCoords, true);
    // Confirm strict data minimization: NO coordinates or address strings in the record
    assert.strictEqual((handoffRecord as any).pickupLat, undefined, "No pickupLat stored in DB");
    assert.strictEqual((handoffRecord as any).pickupAddress, undefined, "No pickupAddress stored in DB");
    assert.strictEqual((handoffRecord as any).dropoffLat, undefined, "No dropoffLat stored in DB");

    // Inspect telemetry events for user
    const userEvents = await storage.getRideEventsByUser(user.id);
    const handoffEvent = userEvents.find((e) => e.eventType === "EXTERNAL_RIDE_HANDOFF");
    assert.ok(handoffEvent, "Telemetry event logged");
    const meta = JSON.parse(handoffEvent.metadata || "{}");
    assert.strictEqual(meta.provider, "uber");
    assert.strictEqual(meta.reason, "no_match");
    assert.strictEqual(meta.hadPickupCoords, true);
    assert.strictEqual(meta.lat, undefined, "Raw latitude must not be present in telemetry metadata");
    assert.strictEqual(meta.pickup, undefined, "Raw pickup string must not be present in telemetry metadata");
    console.log("  ✅ Test 8 Passed: Handoff audit row & telemetry recorded with strict data minimization.");

    // ------------------------------------------------------------------------
    // Test 9: Rate limit returns 429 after 20 handoffs in 10-minute window
    // ------------------------------------------------------------------------
    console.log("  [Test 9] Testing rate limiting (429 after 20 requests)...");
    const rateLimitUser = await storage.createUser({
      fullName: "Rate Limit Student",
      email: `ratelimit_${Date.now()}@campus.edu`,
      password: "securepassword123",
      academicYear: "Sophomore",
      major: "Mathematics",
      gender: "Male",
    });

    const rateLimitToken = jwt.sign(
      { id: rateLimitUser.id, email: rateLimitUser.email, role: "student" },
      jwtSecret,
      { expiresIn: "1h" }
    );

    // Perform exactly 20 valid requests
    for (let i = 1; i <= 20; i++) {
      const res = await testFetch("/api/external-rides/handoffs", {
        method: "POST",
        headers: { Authorization: `Bearer ${rateLimitToken}` },
        body: {
          providerId: "uber",
          pickup: { label: "Campus" },
          dropoff: { label: "Destination" },
          context: { reason: "manual" },
        },
      });
      assert.strictEqual(res.status, 201, `Request #${i} must succeed within limit (status 201)`);
    }

    // 21st request must trigger 429 RateLimitError
    const rateLimitedRes = await testFetch("/api/external-rides/handoffs", {
      method: "POST",
      headers: { Authorization: `Bearer ${rateLimitToken}` },
      body: {
        providerId: "uber",
        pickup: { label: "Campus" },
        dropoff: { label: "Destination" },
        context: { reason: "manual" },
      },
    });
    assert.strictEqual(rateLimitedRes.status, 429, "21st handoff must return 429 Too Many Requests");
    const rateLimitProblem = await rateLimitedRes.json();
    assert.strictEqual(rateLimitProblem.type, "urn:problem:rate-limited");
    console.log("  ✅ Test 9 Passed: Rate limit strictly enforced after 20 handoffs per user window.");

    console.log("\n🎉 All 10 External Ride-Hailing Fallback tests passed successfully!\n");
  } catch (err) {
    console.error("❌ External Rides Test Assertion Failure:", err);
    throw err;
  }
}

runExternalRidesTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ External Rides Suite Failed:", err);
    process.exit(1);
  });
