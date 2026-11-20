CREATE TABLE "external_ride_handoffs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"provider_id" text NOT NULL,
	"reason" text NOT NULL,
	"had_pickup_coords" boolean NOT NULL,
	"had_dropoff_coords" boolean NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "external_ride_handoffs" ADD CONSTRAINT "external_ride_handoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_ride_handoffs_user_created_idx" ON "external_ride_handoffs" USING btree ("user_id","created_at");