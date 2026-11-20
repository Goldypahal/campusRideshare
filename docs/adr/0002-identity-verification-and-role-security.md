# ADR 0002: Identity Verification & Role-Based Security

## Status
Accepted

## Context
Initial audits revealed critical vulnerabilities where users could self-assign the `responder` or `admin` role upon registration, and verification tokens were leaked directly into HTTP response bodies. Additionally, unverified accounts could post and book rides.

## Decision
1. **Public Registration Stripping**: The `insertUserSchema` strictly omits `role`. Public registrations always default to `student`.
2. **Audited Role Assignment**: Elevating permissions (e.g. to `responder` or `admin`) is restricted to `POST /api/admin/users/:id/roles`, authenticated with admin privileges and appended to an immutable audit log.
3. **Institutional Verification & Token Hashing**: Verification tokens are generated using 256-bit cryptographically secure entropy, hashed using SHA-256 for persistent database storage with a 30-minute TTL, and delivered exclusively via out-of-band email notifications.
4. **Enforced Gatekeeper**: `requireVerified` middleware is applied to ride creation, ride bookings, chat messaging, and ratings.

## Consequences
- Zero possibility of unverified student self-privilege escalation.
- Full compliance with institutional trust mandates.
