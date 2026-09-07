import assert from "node:assert";
import { insertUserSchema, insertRideSchema } from "../../shared/schema";

console.log("🧪 Running CampusRideshare schema tests...");

// Test 1: Valid .edu email
const validUser = insertUserSchema.safeParse({
  email: "student@university.edu",
  password: "securepassword123",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
});
assert.strictEqual(validUser.success, true, "Valid .edu email should pass validation");
console.log("✅ Test 1 Passed: Valid .edu email accepted");

// Test 2: Invalid non-.edu email
const invalidUser = insertUserSchema.safeParse({
  email: "student@gmail.com",
  password: "securepassword123",
  fullName: "Alex Rivera",
  academicYear: "Junior",
  gender: "Non-binary",
  major: "Computer Science",
});
assert.strictEqual(invalidUser.success, false, "Non-.edu email must fail validation");
console.log("✅ Test 2 Passed: Non-.edu email correctly rejected");

// Test 3: Valid seats count
const validRide = insertRideSchema.safeParse({
  origin: "North Campus Quad",
  destination: "Downtown Station",
  date: "2026-08-01",
  time: "09:30",
  availableSeats: 3,
  costPerPerson: 5,
});
assert.strictEqual(validRide.success, true, "Valid ride seats should pass validation");
console.log("✅ Test 3 Passed: Valid ride seats count accepted");

// Test 4: Invalid seats count (> 4)
const invalidRide = insertRideSchema.safeParse({
  origin: "North Campus Quad",
  destination: "Downtown Station",
  date: "2026-08-01",
  time: "09:30",
  availableSeats: 10,
  costPerPerson: 5,
});
assert.strictEqual(invalidRide.success, false, "Available seats > 4 must fail validation");
console.log("✅ Test 4 Passed: Seat count > 4 correctly rejected");

console.log("🎉 All 4 schema tests passed successfully!");
