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
  type RideEvent,
  type InsertRideEvent,
  type VerificationToken,
  type InsertVerificationToken,
  type SafetyIncident,
  type InsertSafetyIncident,
  users,
  rides,
  rideRequests,
  messages,
  ratings,
  rideEvents,
  verificationTokens,
  safetyIncidents,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, and, asc, desc, gt, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { calculateTrustScore } from "./services/reputation.service";

export interface RideSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  time?: string;
  timeWindow?: number;
  genderPref?: string;
  yearPref?: string;
  isRecurring?: boolean;
  minSeats?: number;
  page?: number;
  limit?: number;
}

export interface RideWithDriver extends Ride {
  driver: Omit<User, "password"> | null;
}

export interface PaginatedRides {
  items: RideWithDriver[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
  searchRides(params: RideSearchParams): Promise<PaginatedRides>;
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
  cancelRideRequestAtomic(requestId: string, userId: string): Promise<{
    success: boolean;
    request?: RideRequest;
    ride?: Ride;
    error?: string;
    statusCode?: number;
  }>;

  // Messaging & Authorization
  createMessage(message: InsertMessage & { fromUserId: string }): Promise<Message>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string, offset?: number, limit?: number): Promise<Message[]>;
  canUsersCommunicate(user1Id: string, user2Id: string, rideId?: string): Promise<boolean>;

  // Rating methods
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  createRatingEligible(ratingData: InsertRating & { fromUserId: string }): Promise<{
    success: boolean;
    rating?: Rating;
    error?: string;
    statusCode?: number;
  }>;
  getRatingsByUser(userId: string): Promise<Rating[]>;
  updateUserRating(userId: string): Promise<void>;

  // Telemetry Event methods
  createRideEvent(event: InsertRideEvent): Promise<RideEvent>;
  getRideEventsByUser(userId: string): Promise<RideEvent[]>;

  // Verification Token methods
  createVerificationToken(tokenData: InsertVerificationToken): Promise<VerificationToken>;
  getVerificationToken(token: string): Promise<VerificationToken | undefined>;
  markTokenUsed(id: string): Promise<void>;

  // Safety Incident methods
  createSafetyIncident(incident: InsertSafetyIncident): Promise<SafetyIncident>;
  getSafetyIncident(id: string): Promise<SafetyIncident | undefined>;
  updateSafetyIncident(id: string, updateData: Partial<SafetyIncident>): Promise<SafetyIncident | undefined>;
  listActiveIncidents(): Promise<SafetyIncident[]>;
}

export class TransactionError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
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
      role: (insertUser as any).role ?? "student",
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

  async searchRides(params: RideSearchParams): Promise<PaginatedRides> {
    if (!db) return { items: [], total: 0, page: 1, limit: 50, totalPages: 0 };
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions = [
      eq(rides.status, "active"),
      gt(rides.availableSeats, 0),
    ];

    if (params.origin) {
      conditions.push(sql`LOWER(${rides.origin}) LIKE ${'%' + params.origin.toLowerCase() + '%'}`);
    }
    if (params.destination) {
      conditions.push(sql`LOWER(${rides.destination}) LIKE ${'%' + params.destination.toLowerCase() + '%'}`);
    }
    if (params.date) {
      conditions.push(eq(rides.date, params.date));
    }
    if (params.isRecurring !== undefined) {
      conditions.push(eq(rides.isRecurring, params.isRecurring));
    }
    if (params.minSeats) {
      conditions.push(gte(rides.availableSeats, params.minSeats));
    }

    const whereClause = and(...conditions);

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rides)
      .where(whereClause);
    const total = Number(countResult?.count || 0);

    // Filtered page query
    const rawRides = await db
      .select()
      .from(rides)
      .where(whereClause)
      .orderBy(desc(rides.createdAt))
      .offset(offset)
      .limit(limit);

    // Attach drivers
    const items: RideWithDriver[] = await Promise.all(
      rawRides.map(async (r) => {
        const d = await this.getUser(r.driverId);
        const driverSafe = d ? (({ password, ...rest }) => rest)(d) : null;
        return { ...r, driver: driverSafe };
      })
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
      seatsRequested: requestData.seatsRequested ?? 1,
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

    try {
      return await db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(rideRequests)
          .where(eq(rideRequests.id, requestId));

        if (!request) {
          return { success: false, error: "Request not found", statusCode: 404 };
        }
        if (request.status !== "pending") {
          return { success: false, error: `Request already ${request.status}`, statusCode: 400 };
        }

        const [ride] = await tx
          .select()
          .from(rides)
          .where(eq(rides.id, request.rideId));

        if (!ride || ride.driverId !== driverUserId) {
          return { success: false, error: "Not authorized to update this request", statusCode: 403 };
        }

        const seatsToReserve = request.seatsRequested || 1;
        if (ride.availableSeats < seatsToReserve) {
          return { success: false, error: `Not enough available seats (requested ${seatsToReserve}, available ${ride.availableSeats})`, statusCode: 400 };
        }

        // Atomically reserve seats conditionally within database transaction
        const [updatedRide] = await tx
          .update(rides)
          .set({
            availableSeats: sql`${rides.availableSeats} - ${seatsToReserve}`,
            status: sql`CASE WHEN ${rides.availableSeats} - ${seatsToReserve} <= 0 THEN 'full' ELSE ${rides.status} END`,
          })
          .where(and(eq(rides.id, ride.id), gte(rides.availableSeats, seatsToReserve)))
          .returning();

        if (!updatedRide) {
          throw new TransactionError("No available seats remaining for this ride", 400);
        }

        // Atomically set status to accepted within database transaction
        const [updatedRequest] = await tx
          .update(rideRequests)
          .set({ status: "accepted" })
          .where(and(eq(rideRequests.id, requestId), eq(rideRequests.status, "pending")))
          .returning();

        if (!updatedRequest) {
          throw new TransactionError("Request was modified concurrently", 409);
        }

        return { success: true, request: updatedRequest, ride: updatedRide };
      });
    } catch (err: any) {
      if (err instanceof TransactionError) {
        return { success: false, error: err.message, statusCode: err.statusCode };
      }
      throw err;
    }
  }

  async cancelRideRequestAtomic(requestId: string, userId: string): Promise<{
    success: boolean;
    request?: RideRequest;
    ride?: Ride;
    error?: string;
    statusCode?: number;
  }> {
    if (!db) throw new Error("Database not connected");

    try {
      return await db.transaction(async (tx) => {
        const [request] = await tx
          .select()
          .from(rideRequests)
          .where(eq(rideRequests.id, requestId));

        if (!request) {
          return { success: false, error: "Request not found", statusCode: 404 };
        }

        const [ride] = await tx
          .select()
          .from(rides)
          .where(eq(rides.id, request.rideId));

        if (!ride) {
          return { success: false, error: "Associated ride not found", statusCode: 404 };
        }

        // Must be either passenger or driver to cancel
        if (request.passengerId !== userId && ride.driverId !== userId) {
          return { success: false, error: "Not authorized to cancel this request", statusCode: 403 };
        }

        if (request.status === "cancelled" || request.status === "rejected") {
          return { success: false, error: `Request is already ${request.status}`, statusCode: 400 };
        }

        const wasAccepted = request.status === "accepted";
        const seatsToRestore = request.seatsRequested || 1;

        const [updatedRequest] = await tx
          .update(rideRequests)
          .set({ status: "cancelled" })
          .where(and(eq(rideRequests.id, requestId), or(eq(rideRequests.status, "pending"), eq(rideRequests.status, "accepted"))))
          .returning();

        if (!updatedRequest) {
          throw new TransactionError("Request status changed concurrently", 409);
        }

        let updatedRide = ride;
        if (wasAccepted) {
          const [restoredRide] = await tx
            .update(rides)
            .set({
              availableSeats: sql`${rides.availableSeats} + ${seatsToRestore}`,
              status: sql`CASE WHEN ${rides.status} = 'full' THEN 'active' ELSE ${rides.status} END`,
            })
            .where(eq(rides.id, ride.id))
            .returning();
          if (restoredRide) updatedRide = restoredRide;
        }

        return { success: true, request: updatedRequest, ride: updatedRide };
      });
    } catch (err: any) {
      if (err instanceof TransactionError) {
        return { success: false, error: err.message, statusCode: err.statusCode };
      }
      throw err;
    }
  }

  async canUsersCommunicate(user1Id: string, user2Id: string, rideId?: string): Promise<boolean> {
    if (!db) return false;
    if (user1Id === user2Id) return false;

    // Check mutual ride participation (one driver, other passenger)
    if (rideId) {
      const ride = await this.getRide(rideId);
      if (!ride) return false;

      const isUser1Driver = ride.driverId === user1Id;
      const isUser2Driver = ride.driverId === user2Id;

      if (!isUser1Driver && !isUser2Driver) return false;
      const passengerId = isUser1Driver ? user2Id : user1Id;

      const requests = await this.getRideRequestsByRide(rideId);
      return requests.some((r) => r.passengerId === passengerId && ["pending", "accepted"].includes(r.status ?? ""));
    }

    // Check any active or pending ride relationship
    const ridesAsDriver = await this.getRidesByDriver(user1Id);
    for (const r of ridesAsDriver) {
      const reqs = await this.getRideRequestsByRide(r.id);
      if (reqs.some((rq) => rq.passengerId === user2Id && ["pending", "accepted"].includes(rq.status ?? ""))) {
        return true;
      }
    }

    const ridesAsOtherDriver = await this.getRidesByDriver(user2Id);
    for (const r of ridesAsOtherDriver) {
      const reqs = await this.getRideRequestsByRide(r.id);
      if (reqs.some((rq) => rq.passengerId === user1Id && ["pending", "accepted"].includes(rq.status ?? ""))) {
        return true;
      }
    }

    return false;
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

  async createRatingEligible(ratingData: InsertRating & { fromUserId: string }): Promise<{
    success: boolean;
    rating?: Rating;
    error?: string;
    statusCode?: number;
  }> {
    if (!db) throw new Error("Database not connected");

    // 1. Verify ride exists and is completed
    const ride = await this.getRide(ratingData.rideId);
    if (!ride) {
      return { success: false, error: "Ride not found", statusCode: 404 };
    }
    if (ride.status !== "completed") {
      return { success: false, error: "Ratings can only be submitted for completed rides", statusCode: 400 };
    }

    // 2. Prevent self-rating
    if (ratingData.fromUserId === ratingData.toUserId) {
      return { success: false, error: "You cannot rate yourself", statusCode: 400 };
    }

    // 3. Verify both users participated in the ride
    const isRaterDriver = ride.driverId === ratingData.fromUserId;
    const isRateeDriver = ride.driverId === ratingData.toUserId;

    if (!isRaterDriver && !isRateeDriver) {
      return { success: false, error: "Rating must involve the driver and a passenger of this ride", statusCode: 403 };
    }

    const passengerId = isRaterDriver ? ratingData.toUserId : ratingData.fromUserId;
    const requests = await this.getRideRequestsByRide(ride.id);
    const validPassenger = requests.some((r) => r.passengerId === passengerId && r.status === "accepted");

    if (!validPassenger) {
      return { success: false, error: "Only confirmed participants of this ride can submit reviews", statusCode: 403 };
    }

    // 4. Check for duplicate ratings for this ride
    const existingRatings = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.rideId, ratingData.rideId),
          eq(ratings.fromUserId, ratingData.fromUserId),
          eq(ratings.toUserId, ratingData.toUserId)
        )
      );

    if (existingRatings.length > 0) {
      return { success: false, error: "You have already reviewed this user for this ride", statusCode: 400 };
    }

    // 5. Insert rating and update recipient trust score
    const [rating] = await db.insert(ratings).values({
      ...ratingData,
      comment: ratingData.comment ?? null,
    }).returning();

    await this.updateUserRating(ratingData.toUserId);

    return { success: true, rating };
  }

  async getRatingsByUser(userId: string): Promise<Rating[]> {
    if (!db) return [];
    return db.select().from(ratings).where(eq(ratings.toUserId, userId));
  }

  async updateUserRating(userId: string): Promise<void> {
    if (!db) return;
    const userRatings = await this.getRatingsByUser(userId);
    const user = await this.getUser(userId);
    if (!user) return;

    if (userRatings.length > 0) {
      const avgRating = userRatings.reduce((sum, r) => sum + r.rating, 0) / userRatings.length;
      const roundedRating = Math.round(avgRating * 10) / 10;
      const totalRides = userRatings.length;

      const trust = calculateTrustScore({
        rating: roundedRating,
        totalRides,
        isVerified: user.isVerified,
      });

      await db.update(users).set({
        rating: roundedRating,
        totalRides,
        trustScore: trust.trustScore,
      }).where(eq(users.id, userId));
    }
  }

  async createRideEvent(eventData: InsertRideEvent): Promise<RideEvent> {
    if (!db) throw new Error("Database not connected");
    const [event] = await db.insert(rideEvents).values({
      ...eventData,
      userId: eventData.userId ?? null,
      rideId: eventData.rideId ?? null,
      metadata: eventData.metadata ?? null,
    }).returning();
    return event;
  }

  async getRideEventsByUser(userId: string): Promise<RideEvent[]> {
    if (!db) return [];
    return db.select().from(rideEvents).where(eq(rideEvents.userId, userId));
  }

  // Verification Tokens
  async createVerificationToken(tokenData: InsertVerificationToken): Promise<VerificationToken> {
    if (!db) throw new Error("Database not connected");
    const [token] = await db.insert(verificationTokens).values(tokenData).returning();
    return token;
  }

  async getVerificationToken(tokenStr: string): Promise<VerificationToken | undefined> {
    if (!db) return undefined;
    const [token] = await db.select().from(verificationTokens).where(eq(verificationTokens.token, tokenStr));
    return token;
  }

  async markTokenUsed(id: string): Promise<void> {
    if (!db) return;
    await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, id));
  }

  // Safety Incidents
  async createSafetyIncident(incidentData: InsertSafetyIncident): Promise<SafetyIncident> {
    if (!db) throw new Error("Database not connected");
    const [incident] = await db.insert(safetyIncidents).values({
      ...incidentData,
      dispatchStatus: (incidentData as any).dispatchStatus ?? "persisted",
      rideId: incidentData.rideId ?? null,
      latitude: incidentData.latitude ?? null,
      longitude: incidentData.longitude ?? null,
      severity: incidentData.severity ?? "critical",
      status: incidentData.status ?? "active",
      resolvedBy: null,
      resolvedAt: null,
    }).returning();
    return incident;
  }

  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> {
    if (!db) return undefined;
    const [incident] = await db.select().from(safetyIncidents).where(eq(safetyIncidents.id, id));
    return incident;
  }

  async updateSafetyIncident(id: string, updateData: Partial<SafetyIncident>): Promise<SafetyIncident | undefined> {
    if (!db) return undefined;
    const [updated] = await db.update(safetyIncidents).set(updateData).where(eq(safetyIncidents.id, id)).returning();
    return updated;
  }

  async listActiveIncidents(): Promise<SafetyIncident[]> {
    if (!db) return [];
    return db.select().from(safetyIncidents).where(eq(safetyIncidents.status, "active")).orderBy(desc(safetyIncidents.createdAt));
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rides: Map<string, Ride>;
  private rideRequests: Map<string, RideRequest>;
  private messages: Map<string, Message>;
  private ratings: Map<string, Rating>;
  private rideEventsMap: Map<string, RideEvent>;
  private tokensMap: Map<string, VerificationToken>;
  private incidentsMap: Map<string, SafetyIncident>;

  constructor() {
    this.users = new Map();
    this.rides = new Map();
    this.rideRequests = new Map();
    this.messages = new Map();
    this.ratings = new Map();
    this.rideEventsMap = new Map();
    this.tokensMap = new Map();
    this.incidentsMap = new Map();
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
      role: (insertUser as any).role ?? "student",
      isVerified: false,
      rating: 0,
      totalRides: 0,
      cancellationCount: 0,
      completedRidesCount: 0,
      trustScore: 85,
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
      originLat: rideData.originLat ?? null,
      originLng: rideData.originLng ?? null,
      destLat: rideData.destLat ?? null,
      destLng: rideData.destLng ?? null,
      routePolyline: null,
      estimatedDurationMins: null,
      distanceKm: null,
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

  async searchRides(params: RideSearchParams): Promise<PaginatedRides> {
    const page = Math.max(params.page || 1, 1);
    const limit = Math.min(Math.max(params.limit || 20, 1), 100);
    const offset = (page - 1) * limit;

    let filtered = Array.from(this.rides.values()).filter(r => r.status === "active" && r.availableSeats > 0);

    if (params.origin) {
      const q = params.origin.toLowerCase();
      filtered = filtered.filter(r => r.origin.toLowerCase().includes(q));
    }
    if (params.destination) {
      const q = params.destination.toLowerCase();
      filtered = filtered.filter(r => r.destination.toLowerCase().includes(q));
    }
    if (params.date) {
      filtered = filtered.filter(r => r.date === params.date);
    }
    if (params.isRecurring !== undefined) {
      filtered = filtered.filter(r => r.isRecurring === params.isRecurring);
    }
    if (params.minSeats) {
      filtered = filtered.filter(r => r.availableSeats >= (params.minSeats || 1));
    }

    if (params.time) {
      const window = params.timeWindow || 30;
      const toMinutes = (t: string) => {
        const [hh, mm] = t.split(":").map(x => parseInt(x, 10) || 0);
        return hh * 60 + mm;
      };
      const target = toMinutes(params.time);
      filtered = filtered.filter(r => {
        try {
          return Math.abs(toMinutes(r.time) - target) <= window;
        } catch {
          return true;
        }
      });
    }

    if (params.genderPref || params.yearPref) {
      filtered = filtered.filter(r => {
        const driver = this.users.get(r.driverId);
        if (!driver) return false;
        if (params.genderPref && driver.gender.toLowerCase() !== params.genderPref.toLowerCase()) return false;
        if (params.yearPref && driver.academicYear.toLowerCase() !== params.yearPref.toLowerCase()) return false;
        return true;
      });
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    const items: RideWithDriver[] = paged.map(r => {
      const d = this.users.get(r.driverId);
      const driverSafe = d ? (({ password, ...rest }) => rest)(d) : null;
      return { ...r, driver: driverSafe };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
      seatsRequested: requestData.seatsRequested ?? 1,
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

    const seatsToReserve = request.seatsRequested || 1;
    if (ride.availableSeats < seatsToReserve) {
      return { success: false, error: `Not enough available seats (requested ${seatsToReserve}, available ${ride.availableSeats})`, statusCode: 400 };
    }

    ride.availableSeats -= seatsToReserve;
    if (ride.availableSeats === 0) {
      ride.status = "full";
    }
    this.rides.set(ride.id, ride);

    request.status = "accepted";
    this.rideRequests.set(request.id, request);

    return { success: true, request, ride };
  }

  async cancelRideRequestAtomic(requestId: string, userId: string): Promise<{
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

    const ride = this.rides.get(request.rideId);
    if (!ride) {
      return { success: false, error: "Associated ride not found", statusCode: 404 };
    }

    if (request.passengerId !== userId && ride.driverId !== userId) {
      return { success: false, error: "Not authorized to cancel this request", statusCode: 403 };
    }

    if (request.status === "cancelled" || request.status === "rejected") {
      return { success: false, error: `Request is already ${request.status}`, statusCode: 400 };
    }

    const wasAccepted = request.status === "accepted";
    const seatsToRestore = request.seatsRequested || 1;

    request.status = "cancelled";
    this.rideRequests.set(request.id, request);

    if (wasAccepted) {
      ride.availableSeats += seatsToRestore;
      if (ride.status === "full" && ride.availableSeats > 0) {
        ride.status = "active";
      }
      this.rides.set(ride.id, ride);
    }

    return { success: true, request, ride };
  }

  async canUsersCommunicate(user1Id: string, user2Id: string, rideId?: string): Promise<boolean> {
    if (user1Id === user2Id) return false;

    if (rideId) {
      const ride = this.rides.get(rideId);
      if (!ride) return false;

      const isUser1Driver = ride.driverId === user1Id;
      const isUser2Driver = ride.driverId === user2Id;
      if (!isUser1Driver && !isUser2Driver) return false;

      const passengerId = isUser1Driver ? user2Id : user1Id;
      const requests = Array.from(this.rideRequests.values()).filter(r => r.rideId === rideId);
      return requests.some(r => r.passengerId === passengerId && ["pending", "accepted"].includes(r.status ?? ""));
    }

    // Mutual ride participation across any ride
    const allRequests = Array.from(this.rideRequests.values());
    for (const req of allRequests) {
      if (!["pending", "accepted"].includes(req.status ?? "")) continue;
      const ride = this.rides.get(req.rideId);
      if (!ride) continue;

      if ((ride.driverId === user1Id && req.passengerId === user2Id) ||
          (ride.driverId === user2Id && req.passengerId === user1Id)) {
        return true;
      }
    }

    return false;
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

  async createRatingEligible(ratingData: InsertRating & { fromUserId: string }): Promise<{
    success: boolean;
    rating?: Rating;
    error?: string;
    statusCode?: number;
  }> {
    const ride = this.rides.get(ratingData.rideId);
    if (!ride) {
      return { success: false, error: "Ride not found", statusCode: 404 };
    }
    if (ride.status !== "completed") {
      return { success: false, error: "Ratings can only be submitted for completed rides", statusCode: 400 };
    }

    if (ratingData.fromUserId === ratingData.toUserId) {
      return { success: false, error: "You cannot rate yourself", statusCode: 400 };
    }

    const isRaterDriver = ride.driverId === ratingData.fromUserId;
    const isRateeDriver = ride.driverId === ratingData.toUserId;

    if (!isRaterDriver && !isRateeDriver) {
      return { success: false, error: "Rating must involve the driver and a passenger of this ride", statusCode: 403 };
    }

    const passengerId = isRaterDriver ? ratingData.toUserId : ratingData.fromUserId;
    const requests = Array.from(this.rideRequests.values()).filter(r => r.rideId === ride.id);
    const validPassenger = requests.some(r => r.passengerId === passengerId && r.status === "accepted");

    if (!validPassenger) {
      return { success: false, error: "Only confirmed participants of this ride can submit reviews", statusCode: 403 };
    }

    // Check duplicate rating
    const alreadyRated = Array.from(this.ratings.values()).some(
      r => r.rideId === ratingData.rideId && r.fromUserId === ratingData.fromUserId && r.toUserId === ratingData.toUserId
    );
    if (alreadyRated) {
      return { success: false, error: "You have already reviewed this user for this ride", statusCode: 400 };
    }

    return {
      success: true,
      rating: await this.createRating(ratingData),
    };
  }

  async getRatingsByUser(userId: string): Promise<Rating[]> {
    return Array.from(this.ratings.values()).filter(rating => rating.toUserId === userId);
  }

  async updateUserRating(userId: string): Promise<void> {
    const userRatings = await this.getRatingsByUser(userId);
    const user = this.users.get(userId);
    
    if (user && userRatings.length > 0) {
      const avgRating = userRatings.reduce((sum, rating) => sum + rating.rating, 0) / userRatings.length;
      const roundedRating = Math.round(avgRating * 10) / 10;
      const totalRides = userRatings.length;

      const trust = calculateTrustScore({
        rating: roundedRating,
        totalRides,
        isVerified: user.isVerified,
      });

      const updatedUser = {
        ...user,
        rating: roundedRating,
        totalRides,
        trustScore: trust.trustScore,
      };
      this.users.set(userId, updatedUser);
    }
  }

  async createRideEvent(eventData: InsertRideEvent): Promise<RideEvent> {
    const id = randomUUID();
    const event: RideEvent = {
      ...eventData,
      id,
      userId: eventData.userId ?? null,
      rideId: eventData.rideId ?? null,
      metadata: eventData.metadata ?? null,
      createdAt: new Date(),
    };
    this.rideEventsMap.set(id, event);
    return event;
  }

  async getRideEventsByUser(userId: string): Promise<RideEvent[]> {
    return Array.from(this.rideEventsMap.values()).filter(event => event.userId === userId);
  }

  // Verification Tokens
  async createVerificationToken(tokenData: InsertVerificationToken): Promise<VerificationToken> {
    const id = randomUUID();
    const token: VerificationToken = {
      ...tokenData,
      id,
      usedAt: null,
      createdAt: new Date(),
    };
    this.tokensMap.set(tokenData.token, token);
    return token;
  }

  async getVerificationToken(tokenStr: string): Promise<VerificationToken | undefined> {
    return this.tokensMap.get(tokenStr);
  }

  async markTokenUsed(id: string): Promise<void> {
    for (const [key, token] of Array.from(this.tokensMap.entries())) {
      if (token.id === id) {
        token.usedAt = new Date();
        this.tokensMap.set(key, token);
        break;
      }
    }
  }

  // Safety Incidents
  async createSafetyIncident(incidentData: InsertSafetyIncident): Promise<SafetyIncident> {
    const id = randomUUID();
    const incident: SafetyIncident = {
      ...incidentData,
      id,
      dispatchStatus: (incidentData as any).dispatchStatus ?? "persisted",
      rideId: incidentData.rideId ?? null,
      latitude: incidentData.latitude ?? null,
      longitude: incidentData.longitude ?? null,
      status: incidentData.status ?? "active",
      severity: incidentData.severity ?? "critical",
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: new Date(),
    };
    this.incidentsMap.set(id, incident);
    return incident;
  }

  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> {
    return this.incidentsMap.get(id);
  }

  async updateSafetyIncident(id: string, updateData: Partial<SafetyIncident>): Promise<SafetyIncident | undefined> {
    const incident = this.incidentsMap.get(id);
    if (!incident) return undefined;
    const updated = { ...incident, ...updateData };
    this.incidentsMap.set(id, updated);
    return updated;
  }

  async listActiveIncidents(): Promise<SafetyIncident[]> {
    return Array.from(this.incidentsMap.values())
      .filter(i => i.status === "active")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
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
