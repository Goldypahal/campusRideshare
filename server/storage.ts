import {
  type User,
  type InsertUser,
  type Ride,
  type InsertRide,
  type RideRequest,
  type InsertRideRequest,
  type Message,
  type InsertMessage,
  type Rating,
  type InsertRating,
  users,
  rides,
  rideRequests,
  messages,
  ratings,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, and, asc, desc, gt, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;

  // Ride methods
  createRide(ride: InsertRide & { driverId: string }): Promise<Ride>;
  getRide(id: string): Promise<Ride | undefined>;
  getRides(offset?: number, limit?: number): Promise<Ride[]>;
  updateRide(id: string, ride: Partial<Ride>): Promise<Ride | undefined>;
  getRidesByDriver(driverId: string): Promise<Ride[]>;

  // Ride request methods
  createRideRequest(request: InsertRideRequest & { passengerId: string }): Promise<RideRequest>;
  getRideRequest(id: string): Promise<RideRequest | undefined>;
  getRideRequestsByRide(rideId: string): Promise<RideRequest[]>;
  getRideRequestsByPassenger(passengerId: string): Promise<RideRequest[]>;
  updateRideRequest(id: string, request: Partial<RideRequest>): Promise<RideRequest | undefined>;
  acceptRideRequestAtomic(requestId: string, driverUserId: string): Promise<{
    success: boolean;
    request?: RideRequest;
    ride?: Ride;
    error?: string;
    statusCode?: number;
  }>;

  // Message methods
  createMessage(message: InsertMessage & { fromUserId: string }): Promise<Message>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string, offset?: number, limit?: number): Promise<Message[]>;

  // Rating methods
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  getRatingsByUser(userId: string): Promise<Rating[]>;
  updateUserRating(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!db) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not connected");
    const [user] = await db.insert(users).values({
      ...insertUser,
      homeAirport: insertUser.homeAirport ?? null,
      housingZone: insertUser.housingZone ?? null,
    }).returning();
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    if (!db) return undefined;
    const [updatedUser] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async createRide(rideData: InsertRide & { driverId: string }): Promise<Ride> {
    if (!db) throw new Error("Database not connected");
    const [ride] = await db.insert(rides).values({
      ...rideData,
      vehicle: rideData.vehicle ?? null,
      notes: rideData.notes ?? null,
      isRecurring: rideData.isRecurring ?? false,
      recurrencePattern: rideData.recurrencePattern ?? null,
    }).returning();
    return ride;
  }

  async getRide(id: string): Promise<Ride | undefined> {
    if (!db) return undefined;
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride;
  }

  async getRides(offset: number = 0, limit: number = 50): Promise<Ride[]> {
    if (!db) return [];
    return db.select().from(rides)
      .where(eq(rides.status, "active"))
      .orderBy(desc(rides.createdAt))
      .offset(offset)
      .limit(limit);
  }

  async updateRide(id: string, updateData: Partial<Ride>): Promise<Ride | undefined> {
    if (!db) return undefined;
    const [updatedRide] = await db.update(rides).set(updateData).where(eq(rides.id, id)).returning();
    return updatedRide;
  }

  async getRidesByDriver(driverId: string): Promise<Ride[]> {
    if (!db) return [];
    return db.select().from(rides).where(eq(rides.driverId, driverId)).orderBy(desc(rides.createdAt));
  }

  async createRideRequest(requestData: InsertRideRequest & { passengerId: string }): Promise<RideRequest> {
    if (!db) throw new Error("Database not connected");
    const [request] = await db.insert(rideRequests).values({
      ...requestData,
      message: requestData.message ?? null,
    }).returning();
    return request;
  }

  async getRideRequest(id: string): Promise<RideRequest | undefined> {
    if (!db) return undefined;
    const [request] = await db.select().from(rideRequests).where(eq(rideRequests.id, id));
    return request;
  }

  async getRideRequestsByRide(rideId: string): Promise<RideRequest[]> {
    if (!db) return [];
    return db.select().from(rideRequests).where(eq(rideRequests.rideId, rideId));
  }

  async getRideRequestsByPassenger(passengerId: string): Promise<RideRequest[]> {
    if (!db) return [];
    return db.select().from(rideRequests).where(eq(rideRequests.passengerId, passengerId)).orderBy(desc(rideRequests.createdAt));
  }

  async updateRideRequest(id: string, updateData: Partial<RideRequest>): Promise<RideRequest | undefined> {
    if (!db) return undefined;
    const [updatedRequest] = await db.update(rideRequests).set(updateData).where(eq(rideRequests.id, id)).returning();
    return updatedRequest;
  }

  async acceptRideRequestAtomic(requestId: string, driverUserId: string): Promise<{
    success: boolean;
    request?: RideRequest;
    ride?: Ride;
    error?: string;
    statusCode?: number;
  }> {
    if (!db) throw new Error("Database not connected");

    const request = await this.getRideRequest(requestId);
    if (!request) {
      return { success: false, error: "Request not found", statusCode: 404 };
    }
    if (request.status !== "pending") {
      return { success: false, error: `Request already ${request.status}`, statusCode: 400 };
    }

    const ride = await this.getRide(request.rideId);
    if (!ride || ride.driverId !== driverUserId) {
      return { success: false, error: "Not authorized to update this request", statusCode: 403 };
    }

    const [updatedRide] = await db
      .update(rides)
      .set({
        availableSeats: sql`${rides.availableSeats} - 1`,
        status: sql`CASE WHEN ${rides.availableSeats} - 1 <= 0 THEN 'full' ELSE ${rides.status} END`,
      })
      .where(and(eq(rides.id, ride.id), gt(rides.availableSeats, 0)))
      .returning();

    if (!updatedRide) {
      return { success: false, error: "No available seats remaining for this ride", statusCode: 400 };
    }

    const [updatedRequest] = await db
      .update(rideRequests)
      .set({ status: "accepted" })
      .where(eq(rideRequests.id, requestId))
      .returning();

    return { success: true, request: updatedRequest, ride: updatedRide };
  }

  async createMessage(messageData: InsertMessage & { fromUserId: string }): Promise<Message> {
    if (!db) throw new Error("Database not connected");
    const [message] = await db.insert(messages).values({
      ...messageData,
      rideId: messageData.rideId ?? null,
    }).returning();
    return message;
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string, offset: number = 0, limit: number = 100): Promise<Message[]> {
    if (!db) return [];
    return db.select().from(messages).where(
      or(
        and(eq(messages.fromUserId, user1Id), eq(messages.toUserId, user2Id)),
        and(eq(messages.fromUserId, user2Id), eq(messages.toUserId, user1Id))
      )
    )
    .orderBy(asc(messages.createdAt))
    .offset(offset)
    .limit(limit);
  }

  async createRating(ratingData: InsertRating & { fromUserId: string }): Promise<Rating> {
    if (!db) throw new Error("Database not connected");
    const [rating] = await db.insert(ratings).values({
      ...ratingData,
      comment: ratingData.comment ?? null,
    }).returning();
    await this.updateUserRating(ratingData.toUserId);
    return rating;
  }

  async getRatingsByUser(userId: string): Promise<Rating[]> {
    if (!db) return [];
    return db.select().from(ratings).where(eq(ratings.toUserId, userId));
  }

  async updateUserRating(userId: string): Promise<void> {
    if (!db) return;
    const userRatings = await this.getRatingsByUser(userId);
    if (userRatings.length > 0) {
      const avgRating = userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length;
      await db.update(users).set({
        rating: Math.round(avgRating * 10) / 10,
        totalRides: userRatings.length,
      }).where(eq(users.id, userId));
    }
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rides: Map<string, Ride>;
  private rideRequests: Map<string, RideRequest>;
  private messages: Map<string, Message>;
  private ratings: Map<string, Rating>;

  constructor() {
    this.users = new Map();
    this.rides = new Map();
    this.rideRequests = new Map();
    this.messages = new Map();
    this.ratings = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      isVerified: false,
      rating: 0,
      totalRides: 0,
      homeAirport: insertUser.homeAirport ?? null,
      housingZone: insertUser.housingZone ?? null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updateData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updateData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createRide(rideData: InsertRide & { driverId: string }): Promise<Ride> {
    const id = randomUUID();
    const ride: Ride = {
      ...rideData,
      id,
      status: "active",
      createdAt: new Date(),
      vehicle: rideData.vehicle ?? null,
      notes: rideData.notes ?? null,
      isRecurring: rideData.isRecurring ?? false,
      recurrencePattern: rideData.recurrencePattern ?? null,
    };
    this.rides.set(id, ride);
    return ride;
  }

  async getRide(id: string): Promise<Ride | undefined> {
    return this.rides.get(id);
  }

  async getRides(offset: number = 0, limit: number = 50): Promise<Ride[]> {
    const active = Array.from(this.rides.values()).filter(ride => ride.status === "active");
    return active.slice(offset, offset + limit);
  }

  async updateRide(id: string, updateData: Partial<Ride>): Promise<Ride | undefined> {
    const ride = this.rides.get(id);
    if (!ride) return undefined;
    
    const updatedRide = { ...ride, ...updateData };
    this.rides.set(id, updatedRide);
    return updatedRide;
  }

  async getRidesByDriver(driverId: string): Promise<Ride[]> {
    return Array.from(this.rides.values()).filter(ride => ride.driverId === driverId);
  }

  async createRideRequest(requestData: InsertRideRequest & { passengerId: string }): Promise<RideRequest> {
    const id = randomUUID();
    const rideRequest: RideRequest = {
      ...requestData,
      id,
      status: "pending",
      createdAt: new Date(),
      message: requestData.message ?? null,
    };
    this.rideRequests.set(id, rideRequest);
    return rideRequest;
  }

  async getRideRequest(id: string): Promise<RideRequest | undefined> {
    return this.rideRequests.get(id);
  }

  async getRideRequestsByRide(rideId: string): Promise<RideRequest[]> {
    return Array.from(this.rideRequests.values()).filter(request => request.rideId === rideId);
  }

  async getRideRequestsByPassenger(passengerId: string): Promise<RideRequest[]> {
    return Array.from(this.rideRequests.values()).filter(request => request.passengerId === passengerId);
  }

  async updateRideRequest(id: string, updateData: Partial<RideRequest>): Promise<RideRequest | undefined> {
    const request = this.rideRequests.get(id);
    if (!request) return undefined;
    
    const updatedRequest = { ...request, ...updateData };
    this.rideRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async acceptRideRequestAtomic(requestId: string, driverUserId: string): Promise<{
    success: boolean;
    request?: RideRequest;
    ride?: Ride;
    error?: string;
    statusCode?: number;
  }> {
    const request = this.rideRequests.get(requestId);
    if (!request) {
      return { success: false, error: "Request not found", statusCode: 404 };
    }
    if (request.status !== "pending") {
      return { success: false, error: `Request already ${request.status}`, statusCode: 400 };
    }

    const ride = this.rides.get(request.rideId);
    if (!ride || ride.driverId !== driverUserId) {
      return { success: false, error: "Not authorized to update this request", statusCode: 403 };
    }

    if (ride.availableSeats <= 0) {
      return { success: false, error: "No available seats remaining for this ride", statusCode: 400 };
    }

    ride.availableSeats -= 1;
    if (ride.availableSeats === 0) {
      ride.status = "full";
    }
    this.rides.set(ride.id, ride);

    request.status = "accepted";
    this.rideRequests.set(request.id, request);

    return { success: true, request, ride };
  }

  async createMessage(messageData: InsertMessage & { fromUserId: string }): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...messageData,
      id,
      createdAt: new Date(),
      rideId: messageData.rideId ?? null,
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string, offset: number = 0, limit: number = 100): Promise<Message[]> {
    const filtered = Array.from(this.messages.values())
      .filter(message =>
        (message.fromUserId === user1Id && message.toUserId === user2Id) ||
        (message.fromUserId === user2Id && message.toUserId === user1Id)
      )
      .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    return filtered.slice(offset, offset + limit);
  }

  async createRating(ratingData: InsertRating & { fromUserId: string }): Promise<Rating> {
    const id = randomUUID();
    const rating: Rating = {
      ...ratingData,
      id,
      createdAt: new Date(),
      comment: ratingData.comment ?? null,
    };
    this.ratings.set(id, rating);
    await this.updateUserRating(ratingData.toUserId);
    return rating;
  }

  async getRatingsByUser(userId: string): Promise<Rating[]> {
    return Array.from(this.ratings.values()).filter(rating => rating.toUserId === userId);
  }

  async updateUserRating(userId: string): Promise<void> {
    const userRatings = await this.getRatingsByUser(userId);
    const user = this.users.get(userId);
    
    if (user && userRatings.length > 0) {
      const avgRating = userRatings.reduce((sum, rating) => sum + rating.rating, 0) / userRatings.length;
      const updatedUser = { ...user, rating: Math.round(avgRating * 10) / 10, totalRides: userRatings.length };
      this.users.set(userId, updatedUser);
    }
  }
}

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("Fatal: MemStorage fallback is prohibited in production mode. Set DATABASE_URL.");
}

if (process.env.DATABASE_URL) {
  console.log("💾 Storage Engine: DatabaseStorage (PostgreSQL / Neon ORM)");
} else {
  console.log("ℹ️ Storage Engine: MemStorage (Fallback in-memory storage)");
}

export const storage: IStorage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();
