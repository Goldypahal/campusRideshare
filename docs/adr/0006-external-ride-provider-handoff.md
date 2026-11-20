# ADR 0006: External Ride-Hailing Fallback (Uber, Ola, Rapido)

## Status
Accepted

## Context
Campus carpooling operates within a peer-to-peer university community. During irregular hours, low-density routes, or short-notice travel, students may find no suitable campus carpools or only low-confidence matches. In these situations, leaving the user stranded undermines campus mobility and safety.

CampusRideshare needs a safe, compliant, and seamless fallback to commercial ride-hailing services (Uber, Ola, Rapido) when no university ride is available or when departure is imminent.

## Decision

We adopt a **phased architecture** starting with **Stage 1 (Deep Link & App Store Handoff)**:

1. **Stage 1 — Official Handoff Only**:
   - Provide client-side redirection to official deep links (Uber universal link) or verified app-store listings (Ola, Rapido).
   - Never scrape, reverse-engineer, or invoke undocumented private endpoints.
   - Display no simulated fares, ETAs, surge rates, or car availability, avoiding false user expectations.
   - Strictly omit `product_id` for Uber in Stage 1 to prevent invalid city tier routing.
   - Build external links on the server (`server/services/external-rides/`) to keep credentials like `UBER_CLIENT_ID` secure and configurable without client deployments.

2. **Strict Spatial Landmark Verification**:
   - Only GPS coordinates provided by the client or exact matches from `lookupKnownPlace()` are passed to external providers.
   - The fallback heuristic `resolveCoordinates()` is strictly excluded from external ride builders to prevent sending commercial cabs to invented coordinates.

3. **Data Minimization & Privacy**:
   - The server records handoff requests in `external_ride_handoffs` for auditing and frequency monitoring.
   - In accordance with DPDP principles, location coordinates and address strings are never stored in the database or telemetry.

4. **Prominent Safety & Privacy Disclosures**:
   - Before handing off, the user is visibly reminded that CampusRide's safety features (SOS alerts, campus responder tracking, verified university community) do not extend to third-party services.
   - Users are directed to the provider's built-in emergency features and emergency helpline 112.

## Alternatives Considered

1. **In-App Booking via Reverse-Engineered Endpoints**: Rejected due to terms of service violations, fragile brittle APIs, and legal risk.
2. **Direct Partner API Integration (Stage 2)**:
   - Uber Rides API and Ola Corporate/Affiliate programs require commercial enterprise agreements and case-by-case partner API keys.
   - Deferred to Stage 2 once institutional traction is demonstrated.
3. **Open Network for Digital Commerce (ONDC) Mobility (Stage 3)**:
   - ONDC Beckn protocol enables buyer-side app integration with multiple mobility providers (Namma Yatri, auto drivers).
   - Planned for Stage 3 evaluation as campus-area ONDC mobility networks mature.

## Consequences
- Students can seamlessly transition to commercial transit when campus carpools are unavailable.
- Zero liability or compliance risks associated with unofficial API scraping or price estimation.
- Clean extension points (`getEstimates`, `book` interfaces) ready for Stage 2 partner API keys.
