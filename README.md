# CampusRideshare

CampusRideshare is an industrial-grade campus carpooling and ride-sharing platform designed exclusively for verified university students, faculty, and campus community members.

## Architecture

- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Wouter.
- **Backend**: Node.js & TypeScript, Express 4, WebSocket server (`ws`).
- **Data Layer**: PostgreSQL 16 (PostGIS / Neon), Drizzle ORM, Redis 7 (rate limiting & pub/sub).
- **ML Intelligence Service**: Python 3.12, FastAPI, Scikit-learn (RandomForest route matching & ETA prediction).

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 with PostGIS extension (or Docker)
- Redis 7 (or Docker)

### Installation

```bash
# Install Node dependencies
npm install

# Install Python ML dependencies
pip install -r ml_service/requirements.txt
```

### Environment Variables

Copy `.env.example` to `.env` and configure your settings:

```bash
cp .env.example .env
```

| Variable | Default (Dev) | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Express backend |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `JWT_SECRET` | Required | Cryptographic secret for signing JWT tokens (min 32 chars in production) |
| `DATABASE_URL` | Optional (MemStorage fallback in dev) | PostgreSQL connection string |
| `EXTERNAL_RIDES_ENABLED` | `true` | Master switch for external ride-hailing fallback |
| `EXTERNAL_RIDES_UBER_ENABLED` | `true` | Toggle Uber fallback provider |
| `EXTERNAL_RIDES_OLA_ENABLED` | `false` | Toggle Ola fallback provider |
| `EXTERNAL_RIDES_RAPIDO_ENABLED` | `false` | Toggle Rapido fallback provider |
| `UBER_CLIENT_ID` | Empty | Uber Developer Client ID (required for Uber universal links) |
| `EXTERNAL_RIDES_MATCH_THRESHOLD` | `60` | Match score percentage (0-100) below which fallback is suggested |
| `EXTERNAL_RIDES_SOON_MINUTES` | `45` | Departure window in minutes within which fallback is suggested |

---

## External Ride-Hailing Fallback (Uber, Ola, Rapido)

When no campus ride fits a student's criteria, the search interface offers an immediate fallback to commercial providers:

- **Uber**: Universal deep link (`https://m.uber.com/ul/`) with pre-filled pickup and drop-off coordinates (when verified).
- **Ola & Rapido**: Direct link to official app store listings or web portals, with one-tap location copying to clipboard.
- **Safety Disclosure**: Prominently informs students that CampusRide safety features (SOS alerts, verified community) do not extend to third-party rides, and reminds them to dial 112.
- **Data Minimization**: Location coordinates and addresses are never stored in external ride audit tables.

### Obtaining an Uber Client ID

To enable Uber universal links:
1. Visit the [Uber Developer Dashboard](https://developer.uber.com) and sign in.
2. Click **Create App** and configure your application details.
3. In the app dashboard under the **General** / **Authentication** tab, locate your **Client ID**.
4. Set the Client ID in your `.env` file:
   ```env
   UBER_CLIENT_ID=your_uber_client_id_here
   ```
*(Note: A client secret is not required for Stage 1 universal deep links).*

---

## Testing & Quality Assurance

```bash
# Run all test suites (Node + Python ML)
npm run test:all

# Run individual test suites
npm run test:schema        # Schema validation tests
npm run test:concurrency   # Atomic booking & concurrency tests
npm run test:safety        # Authorization & safety incident tests
npm run test:integration   # HTTP API integration regression tests
npm run test:external      # External ride-hailing fallback test suite
npm run test:ml            # Python ML pytest suite
```

## Production Build

```bash
npm run build
npm start
```
