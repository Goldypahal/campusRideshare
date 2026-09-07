import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, index } from "drizzle-orm/pg-core";
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
  status: text("status").default("pending"), // pending, accepted, rejected
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    rideIdx: index("ride_requests_ride_idx").on(table.rideId),
    passengerIdx: index("ride_requests_passenger_idx").on(table.passengerId),
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
  };
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  isVerified: true,
  rating: true,
  totalRides: true,
  createdAt: true,
}).extend({
  email: z.string().email().refine(email => email.endsWith('.edu'), {
    message: "Must be a valid university email (.edu domain)"
  }),
  password: z.string().min(6, "Password must be at least 6 characters"),
  academicYear: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]),
  gender: z.enum(["Female", "Male", "Non-binary", "Prefer not to say"]),
  homeAirport: z.string().optional(),
  housingZone: z.string().optional(),
});

export const insertRideSchema = createInsertSchema(rides).omit({
  id: true,
  driverId: true,
  status: true,
  createdAt: true,
}).extend({
  availableSeats: z.number().min(1).max(4),
  costPerPerson: z.number().min(0),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.string().optional(),
});

export const insertRideRequestSchema = createInsertSchema(rideRequests).omit({
  id: true,
  passengerId: true,
  status: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  fromUserId: true,
  createdAt: true,
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  fromUserId: true,
  createdAt: true,
}).extend({
  rating: z.number().min(1).max(5),
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
export type LoginData = z.infer<typeof loginSchema>;

