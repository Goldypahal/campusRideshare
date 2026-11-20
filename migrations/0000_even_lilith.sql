CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar NOT NULL,
	"ride_id" varchar,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_id" varchar NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ride_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"ride_id" varchar,
	"event_type" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ride_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ride_id" varchar NOT NULL,
	"passenger_id" varchar NOT NULL,
	"seats_requested" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending',
	"message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"origin_lat" real,
	"origin_lng" real,
	"dest_lat" real,
	"dest_lng" real,
	"route_polyline" text,
	"estimated_duration_mins" integer,
	"distance_km" real,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"available_seats" integer NOT NULL,
	"cost_per_person" real NOT NULL,
	"vehicle" text,
	"notes" text,
	"is_recurring" boolean DEFAULT false,
	"recurrence_pattern" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "safety_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ride_id" varchar,
	"latitude" real,
	"longitude" real,
	"message" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"severity" text DEFAULT 'critical' NOT NULL,
	"dispatch_status" text DEFAULT 'persisted' NOT NULL,
	"acknowledged_by" varchar,
	"acknowledged_at" timestamp,
	"resolved_by" varchar,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"academic_year" text NOT NULL,
	"gender" text NOT NULL,
	"major" text NOT NULL,
	"is_verified" boolean DEFAULT false,
	"rating" real DEFAULT 0,
	"total_rides" integer DEFAULT 0,
	"cancellation_count" integer DEFAULT 0,
	"completed_rides_count" integer DEFAULT 0,
	"trust_score" integer DEFAULT 85,
	"role" text DEFAULT 'student',
	"home_airport" text,
	"housing_zone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_users_id_fk" FOREIGN KEY ("passenger_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_chat_idx" ON "messages" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "ratings_to_user_idx" ON "ratings" USING btree ("to_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ratings_ride_from_to_idx" ON "ratings" USING btree ("ride_id","from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "ride_events_user_event_idx" ON "ride_events" USING btree ("user_id","event_type");--> statement-breakpoint
CREATE INDEX "ride_events_ride_idx" ON "ride_events" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "ride_requests_ride_idx" ON "ride_requests" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "ride_requests_passenger_idx" ON "ride_requests" USING btree ("passenger_id");--> statement-breakpoint
CREATE INDEX "ride_requests_passenger_status_idx" ON "ride_requests" USING btree ("ride_id","passenger_id","status");--> statement-breakpoint
CREATE INDEX "rides_driver_idx" ON "rides" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "rides_route_idx" ON "rides" USING btree ("origin","destination");--> statement-breakpoint
CREATE INDEX "rides_status_idx" ON "rides" USING btree ("status");--> statement-breakpoint
CREATE INDEX "safety_incidents_status_idx" ON "safety_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "safety_incidents_user_idx" ON "safety_incidents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "safety_incidents_ride_idx" ON "safety_incidents" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_tokens_token_idx" ON "verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_idx" ON "verification_tokens" USING btree ("user_id");