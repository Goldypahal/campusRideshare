import { type User, type InsertUser, type Ride, type InsertRide, type RideRequest, type InsertRideRequest, type Message, type InsertMessage, type Rating, type InsertRating } from "@shared/schema";
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
  getRides(): Promise<Ride[]>;
  updateRide(id: string, ride: Partial<Ride>): Promise<Ride | undefined>;
  getRidesByDriver(driverId: string): Promise<Ride[]>;

  // Ride request methods
  createRideRequest(request: InsertRideRequest & { passengerId: string }): Promise<RideRequest>;
  getRideRequest(id: string): Promise<RideRequest | undefined>;
  getRideRequestsByRide(rideId: string): Promise<RideRequest[]>;
  getRideRequestsByPassenger(passengerId: string): Promise<RideRequest[]>;
  updateRideRequest(id: string, request: Partial<RideRequest>): Promise<RideRequest | undefined>;

  // Message methods
  createMessage(message: InsertMessage & { fromUserId: string }): Promise<Message>;
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]>;

  // Rating methods
  createRating(rating: InsertRating & { fromUserId: string }): Promise<Rating>;
  getRatingsByUser(userId: string): Promise<Rating[]>;
  updateUserRating(userId: string): Promise<void>;
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
    };
    this.rides.set(id, ride);
    return ride;
  }

  async getRide(id: string): Promise<Ride | undefined> {
    return this.rides.get(id);
  }

  async getRides(): Promise<Ride[]> {
    return Array.from(this.rides.values()).filter(ride => ride.status === "active");
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

  async createMessage(messageData: InsertMessage & { fromUserId: string }): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...messageData,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getMessagesBetweenUsers(user1Id: string, user2Id: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.fromUserId === user1Id && message.toUserId === user2Id) ||
        (message.fromUserId === user2Id && message.toUserId === user1Id)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createRating(ratingData: InsertRating & { fromUserId: string }): Promise<Rating> {
    const id = randomUUID();
    const rating: Rating = {
      ...ratingData,
      id,
      createdAt: new Date(),
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

export const storage = new MemStorage();
