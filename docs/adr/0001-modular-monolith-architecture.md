# ADR 0001: Modular Monolith Architecture

## Status
Accepted

## Context
CampusRideshare requires high domain cohesion across identity, ride offerings, seat bookings, real-time messaging, safety incidents, and reputation scoring. Splitting prematurely into microservices would introduce distributed transaction failure modes (e.g. distributed seat overselling) and operational overhead.

## Decision
We adopt a **modular monolith** backend built on Node.js/TypeScript (Express) communicating with:
1. PostgreSQL 16 (system of record with transactional guarantees)
2. Redis (ephemeral caching, pub/sub, sliding rate limiting)
3. Python ML Microservice (specialized route ranking, ETA, and demand intelligence)

Modules are strictly separated by domain interfaces (`identity`, `rides`, `bookings`, `safety`, `messaging`, `ratings`, `admin`). Cross-module access occurs via typed service boundaries rather than cross-table coupling.

## Consequences
- Fast developer velocity and atomic ACID transactions for booking reservations.
- Unified build and shared schema contracts via `@shared/schema`.
- Modules can be cleanly extracted into independent services when throughput requires it.
