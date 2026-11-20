# ADR 0003: Safety SOS Pipeline & Real-Time Isolation

## Status
Accepted

## Context
Safety incidents (SOS triggers) contain sensitive victim identity and live GPS coordinates. Audits revealed that unauthenticated sockets could subscribe to the global incident stream and eavesdrop on active alerts. Furthermore, ordinary students could subscribe to any ride room without participation checks.

## Decision
1. **Incident Stream Isolation**: The WebSocket event `subscribe_incident_stream` strictly enforces that the connected socket belongs to an authenticated user with the `responder` or `admin` role. Unauthorized subscribers are terminated with error codes.
2. **Ride Room Participation Checks**: The `subscribe_ride` event verifies that the caller is either the ride's driver or a confirmed passenger with an accepted booking before admitting the socket to the room.
3. **Honest Dispatch Status**: The API dynamically counts active, authorized responder sockets. If responders are present, incidents are marked `delivered_to_responder`; otherwise, they enter `persisted_queued_for_responders` for escalation.
4. **Resilience**: The client UI provides direct fallback links to dial 112 (National Emergency Helpline) in addition to digital alerts.

## Consequences
- Guaranteed zero telemetry or GPS leakage to unauthorized peers.
- Predictable and audited safety incident lifecycle (active -> acknowledged -> resolved).
