import assert from "node:assert";
import {
  insertUserSchema,
  insertRideSchema,
  insertRideRequestSchema,
  insertMessageSchema,
  insertSafetyIncidentSchema,
  insertVerificationTokenSchema,
} from "../../shared/schema";

console.log("🧪 Running CampusRideshare schema validation tests...");

// Test 1: Valid .edu email
const validEduUser = insertUserSchema.safeParse({
  email: "student@university.edu",
  password: "securepassword123",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
});
assert.strictEqual(validEduUser.success, true, "Valid .edu email should pass validation");
console.log("✅ Test 1 Passed: Valid .edu email accepted");

// Test 2: Valid Indian university email (.ac.in)
const validIndianUser = insertUserSchema.safeParse({
  email: "student@iitd.ac.in",
  password: "securepassword123",
  fullName: "Rohan Sharma",
  academicYear: "Senior",
  gender: "Male",
  major: "Electrical Engineering",
});
assert.strictEqual(validIndianUser.success, true, "Valid .ac.in Indian university email should pass validation");
console.log("✅ Test 2 Passed: Valid .ac.in email accepted");

// Test 3: Invalid generic email (gmail.com)
const invalidUser = insertUserSchema.safeParse({
  email: "student@gmail.com",
  password: "securepassword123",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
});
assert.strictEqual(invalidUser.success, false, "Non-institutional email must fail validation");
console.log("✅ Test 3 Passed: Non-institutional email correctly rejected");

// Test 4: Valid seats count (3 seats)
const validRide = insertRideSchema.safeParse({
  origin: "North Campus Quad",
  destination: "Downtown Station",
  date: "2026-08-01",
  time: "09:30",
  availableSeats: 3,
  costPerPerson: 5,
});
assert.strictEqual(validRide.success, true, "Valid ride seats should pass validation");
console.log("✅ Test 4 Passed: Valid ride seats count accepted");

// Test 5: Invalid seats count (> 4)
const invalidRide = insertRideSchema.safeParse({
  origin: "North Campus Quad",
  destination: "Downtown Station",
  date: "2026-08-01",
  time: "09:30",
  availableSeats: 10,
  costPerPerson: 5,
});
assert.strictEqual(invalidRide.success, false, "Available seats > 4 must fail validation");
console.log("✅ Test 5 Passed: Seat count > 4 correctly rejected");

// Test 6: Ride request with requested seats
const validRideReq = insertRideRequestSchema.safeParse({
  rideId: "ride-123",
  seatsRequested: 2,
  message: "Heading to the same library session",
});
assert.strictEqual(validRideReq.success, true, "Valid ride request with seatsRequested should pass");
console.log("✅ Test 6 Passed: Ride request with seatsRequested validated");

// Test 7: Message length constraints
const emptyMessage = insertMessageSchema.safeParse({
  toUserId: "user-456",
  content: "",
});
assert.strictEqual(emptyMessage.success, false, "Empty message should fail validation");

const validMessage = insertMessageSchema.safeParse({
  toUserId: "user-456",
  content: "Hey, are you still leaving at 2:00 PM?",
});
assert.strictEqual(validMessage.success, true, "Valid message should pass validation");
console.log("✅ Test 7 Passed: Message length validation enforced");

// Test 8: Safety incident schema validation
const validIncident = insertSafetyIncidentSchema.safeParse({
  userId: "user-123",
  rideId: "ride-456",
  latitude: 28.545,
  longitude: 77.192,
  message: "Suspicious vehicle deviation",
  severity: "critical",
  status: "active",
});
assert.strictEqual(validIncident.success, true, "Valid safety incident should pass validation");
console.log("✅ Test 8 Passed: Safety incident schema validated");

// Test 9: Verification token schema validation
const validToken = insertVerificationTokenSchema.safeParse({
  userId: "user-123",
  token: "abc123token456",
  type: "email_verification",
  expiresAt: new Date(Date.now() + 86400000),
});
assert.strictEqual(validToken.success, true, "Valid verification token should pass validation");
console.log("✅ Test 9 Passed: Verification token schema validated");

// Test 10: Password minimum length (10 chars)
const shortPasswordUser = insertUserSchema.safeParse({
  email: "student@university.edu",
  password: "short",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
});
assert.strictEqual(shortPasswordUser.success, false, "Password shorter than 10 characters must fail validation");
console.log("✅ Test 10 Passed: Minimum 10 character password policy enforced");

// Test 11: Role stripping - insertUserSchema must omit role
const roleInjectedUser: any = insertUserSchema.safeParse({
  email: "student@university.edu",
  password: "securepassword123",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
  role: "admin",
});
assert.strictEqual(roleInjectedUser.success, true, "Registration with role property should succeed schema parse");
assert.strictEqual(roleInjectedUser.data.role, undefined, "insertUserSchema must strip role from registration payload");
console.log("✅ Test 11 Passed: Role field stripped from public registration schema");

console.log("🎉 All 11 schema tests passed successfully!");
