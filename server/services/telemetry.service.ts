import { storage } from "../storage";
import type { InsertRideEvent } from "@shared/schema";

export type EventType =
  | "VIEW_RIDE"
  | "CLICK_RIDE"
  | "REQUEST_RIDE"
  | "ACCEPT_REQUEST"
  | "REJECT_REQUEST"
  | "CANCEL_RIDE"
  | "COMPLETE_RIDE"
  | "RATE_RIDE"
  | "EMERGENCY_SOS"
  | "SAFETY_INCIDENT_ACKNOWLEDGED"
  | "SAFETY_INCIDENT_RESOLVED"
  | "SAFETY_INCIDENT_ACCESSED"
  | "EXTERNAL_RIDE_HANDOFF";

/**
 * Asynchronously log user telemetry events without blocking main request lifecycle
 */
export function logTelemetryEvent(
  eventType: EventType,
  userId?: string,
  rideId?: string,
  metadata?: Record<string, any>
): void {
  const eventPayload: InsertRideEvent = {
    eventType,
    userId: userId ?? null,
    rideId: rideId ?? null,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };

  // Execute asynchronously
  storage.createRideEvent(eventPayload).catch((err) => {
    console.error(`[Telemetry Error] Failed to log event ${eventType}:`, err);
  });
}
