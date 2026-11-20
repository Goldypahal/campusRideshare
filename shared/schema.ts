import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  academicYear: text("academic_year").notNull(),
  gender: text("gender").notNull(),
  major: text("major").notNull(),
  isVerified: boolean("is_verified").default(false),
  rating: real("rating").default(0),
  totalRides: integer("total_rides").default(0),
  cancellationCount: integer("cancellation_count").default(0),
  completedRidesCount: integer("completed_rides_count").default(0),
  trustScore: integer("trust_score").default(85),
  role: text("role").default("student"), // student, responder, admin
  homeAirport: text("home_airport"),
  housingZone: text("housing_zone"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    emailIdx: index("users_email_idx").on(table.email),
  };
});

export const rides = pgTable("rides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => users.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  originLat: real("origin_lat"),
  originLng: real("origin_lng"),
  destLat: real("dest_lat"),
  destLng: real("dest_lng"),
  routePolyline: text("route_polyline"),
  estimatedDurationMins: integer("estimated_duration_mins"),
  distanceKm: real("distance_km"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  availableSeats: integer("available_seats").notNull(),
  costPerPerson: real("cost_per_person").notNull(),
  vehicle: text("vehicle"),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // e.g. "Weekly - MWF", "Daily"
  status: text("status").default("active"), // active, full, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    driverIdx: index("rides_driver_idx").on(table.driverId),
    routeIdx: index("rides_route_idx").on(table.origin, table.destination),
    statusIdx: index("rides_status_idx").on(table.status),
  };
});

export const rideRequests = pgTable("ride_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull().references(() => rides.id),
  passengerId: varchar("passenger_id").notNull().references(() => users.id),
  seatsRequested: integer("seats_requested").notNull().default(1),
  status: text("status").default("pending"), // pending, accepted, rejected, cancelled
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    rideIdx: index("ride_requests_ride_idx").on(table.rideId),
    passengerIdx: index("ride_requests_passenger_idx").on(table.passengerId),
    ridePassengerStatusIdx: index("ride_requests_passenger_status_idx").on(table.rideId, table.passengerId, table.status),
  };
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id),
  toUserId: varchar("to_user_id").notNull().references(() => users.id),
  rideId: varchar("ride_id").references(() => rides.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    chatIdx: index("messages_chat_idx").on(table.fromUserId, table.toUserId),
  };
});

export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rideId: varchar("ride_id").notNull().references(() => rides.id),
  fromUserId: varchar("from_user_id").notNull().references(() => users.id),
  toUserId: varchar("to_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    toUserIdx: index("ratings_to_user_idx").on(table.toUserId),
    uniqueRideReviewIdx: uniqueIndex("ratings_ride_from_to_idx").on(table.rideId, table.fromUserId, table.toUserId),
  };
});

export const rideEvents = pgTable("ride_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  rideId: varchar("ride_id").references(() => rides.id),
  eventType: text("event_type").notNull(), // VIEW_RIDE, CLICK_RIDE, REQUEST_RIDE, ACCEPT_REQUEST, REJECT_REQUEST, CANCEL_RIDE, COMPLETE_RIDE, RATE_RIDE
  metadata: text("metadata"), // JSON string containing contextual features
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    userEventTypeIdx: index("ride_events_user_event_idx").on(table.userId, table.eventType),
    rideIdx: index("ride_events_ride_idx").on(table.rideId),
  };
});

export const verificationTokens = pgTable("verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  type: text("type").notNull(), // "email_verification" | "password_reset"
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    tokenIdx: index("verification_tokens_token_idx").on(table.token),
    userIdIdx: index("verification_tokens_user_idx").on(table.userId),
  };
});

export const safetyIncidents = pgTable("safety_incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rideId: varchar("ride_id").references(() => rides.id),
  latitude: real("latitude"),
  longitude: real("longitude"),
  message: text("message").notNull(),
  status: text("status").notNull().default("active"), // active, acknowledged, resolved
  severity: text("severity").notNull().default("critical"), // warning, critical
  dispatchStatus: text("dispatch_status").notNull().default("persisted"), // persisted, dispatch_pending, delivered_to_responder, acknowledged, resolved
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    statusIdx: index("safety_incidents_status_idx").on(table.status),
    userIdx: index("safety_incidents_user_idx").on(table.userId),
    rideIdx: index("safety_incidents_ride_idx").on(table.rideId),
  };
});

export function isValidUniversityEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1].toLowerCase();
  
  if (domain.endsWith(".edu") || domain.endsWith(".ac.in") || domain.endsWith(".edu.in")) {
    return true;
  }
  
  const customDomains = (typeof process !== "undefined" && process.env?.ALLOWED_EMAIL_DOMAINS)
    ? process.env.ALLOWED_EMAIL_DOMAINS.split(",").map(d => d.trim().toLowerCase())
    : [];
  
  return customDomains.some(cd => domain === cd || domain.endsWith("." + cd));
}

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isVerified: true,
  rating: true,
  totalRides: true,
  cancellationCount: true,
  completedRidesCount: true,
  trustScore: true,
  role: true, // Role cannot be set during registration (Finding 1)
  createdAt: true,
}).extend({
  email: z.string().email().refine(isValidUniversityEmail, {
    message: "Must be a valid university/institutional email (.edu, .ac.in, or approved campus domain)"
  }),
  password: z.string().min(10, "Password must be at least 10 characters"),
  academicYear: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]),
  gender: z.enum(["Female", "Male", "Non-binary", "Prefer not to say"]),
  homeAirport: z.string().optional(),
  housingZone: z.string().optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Full name cannot be empty").max(100).optional(),
  academicYear: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]).optional(),
  major: z.string().min(1).max(100).optional(),
  homeAirport: z.string().max(10).optional(),
  housingZone: z.string().max(50).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["student", "driver", "responder", "admin"]),
  reason: z.string().min(3, "Audit reason is required for role changes").max(500),
});

export const insertRideSchema = createInsertSchema(rides).omit({
  id: true,
  driverId: true,
  status: true,
  createdAt: true,
}).extend({
  availableSeats: z.number().min(1).max(4),
  costPerPerson: z.number().min(0),
  originLat: z.number().optional(),
  originLng: z.number().optional(),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.string().optional(),
});

export const insertRideRequestSchema = createInsertSchema(rideRequests).omit({
  id: true,
  passengerId: true,
  status: true,
  createdAt: true,
}).extend({
  seatsRequested: z.number().min(1).max(4).default(1),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  fromUserId: true,
  createdAt: true,
}).extend({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message cannot exceed 2000 characters"),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  fromUserId: true,
  createdAt: true,
}).extend({
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const insertSafetyIncidentSchema = createInsertSchema(safetyIncidents).omit({
  id: true,
  acknowledgedBy: true,
  acknowledgedAt: true,
  resolvedBy: true,
  resolvedAt: true,
  createdAt: true,
}).extend({
  dispatchStatus: z.string().optional(),
});

export const insertVerificationTokenSchema = createInsertSchema(verificationTokens).omit({
  id: true,
  usedAt: true,
  createdAt: true,
});

export const insertRideEventSchema = createInsertSchema(rideEvents).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRide = z.infer<typeof insertRideSchema>;
export type Ride = typeof rides.$inferSelect;
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;
export type RideRequest = typeof rideRequests.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertRideEvent = z.infer<typeof insertRideEventSchema>;
export type RideEvent = typeof rideEvents.$inferSelect;
export type InsertSafetyIncident = z.infer<typeof insertSafetyIncidentSchema>;
export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;
export type UpdateProfileData = z.infer<typeof updateProfileSchema>;
export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;



