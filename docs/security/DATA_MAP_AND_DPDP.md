# Digital Personal Data Protection (DPDP) Act Compliance & Data Map

In compliance with India's Digital Personal Data Protection Act, 2023 and DPDP Rules, CampusRideshare implements transparent consent, minimization, purpose limitation, and strict data retention controls.

## Personal Data Inventory

| Field | Purpose | Lawful Basis | Storage | Retention Period | Access Controls |
|---|---|---|---|---|---|
| Institutional Email | Student verification & login | Contractual necessity | PostgreSQL (indexed) | Duration of student enrollment + 90 days grace | User, Authorized Admin |
| Full Name & Gender | Profile identification & safety | Explicit Consent | PostgreSQL | Duration of account lifecycle | Public to confirmed co-riders |
| Password (Argon2id/Bcrypt) | Authentication security | Security | PostgreSQL (salted hash) | Until updated / account deletion | None (hashed only) |
| Live GPS Coordinates | In-transit navigation & SOS dispatch | Safety & Emergency | Ephemeral Redis buffer / PostgreSQL Incident Table | 72 hours for standard trips; Indefinite if attached to active emergency incident | Driver, Confirmed Co-riders, Authorized Responders |
| ID Card / Verification Document | Driver verification (Tier 2/3) | KYC & Safety verification | Encrypted Private Bucket (AES-256) | Purged 14 days post-verification | Campus Verification Admins only (audited) |
| Chat Content | Co-rider coordination | Explicit communication | PostgreSQL | 12 months from trip completion | Conversation participants only |
| Safety Incidents & Audio Notes | Emergency response & audit | Vital interest / Legal obligation | PostgreSQL | 7 years (statutory safety retention) | Assigned Campus Responders & Admins |

## Data Subject Rights Workflow

1. **Right to Access / Download**: Users can trigger self-service data exports via `/api/users/me/export` (structured JSON).
2. **Right to Correction**: Self-service profile updates via `PATCH /api/users/me` with audit trail for trust-sensitive fields.
3. **Right to Erasure / Deletion**: Account deletion marks record soft-deleted with immediate token invalidation and permanent purging within 30 days unless subject to active security hold.
4. **Grievance Redressal**: Direct point of contact at `grievance-officer@campusrideshare.edu`.
