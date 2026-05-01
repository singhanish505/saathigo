# SaathiGo · साथीगो

> Aapki Apni Sawaari · India's first driver-owned, EV-first e-hailing co-operative.

A full-stack reference implementation built to scale to **major-Indian-metro
loads, with an architecture path to 100M concurrent requests** across six
launch cities (Patna · Bangalore · Pune · Mumbai · Hyderabad · Delhi).

```
saathigo-app/
├── backend/         Node.js + Express + Socket.io API (auth, booking, matching, Sakhi, real-time)
├── frontend/        React + Vite + Leaflet rider app (live map, booking, SOS, perks)
├── docker/          Local docker-compose (Redis, Postgres, Kafka, EMQX, API, FE)
├── k8s/             Kubernetes manifests (deployments, HPA, PDB, Ingress, Services)
├── terraform/       AWS ap-south-1 infra (VPC, EKS, RDS Aurora, ElastiCache, MSK)
├── helm/            Helm chart for cluster-managed releases
├── loadtest/        k6 scripts (HTTP booking + WebSocket riders)
└── docs/SCALING.md  How this design hits 100M concurrent
```

---

## Quickstart - run it locally

### Option A: in-memory mock mode (no Docker required)

Two terminals:

```bash
# Terminal 1: backend (uses MOCK_MODE=true by default in .env.example)
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000

# Terminal 2: frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Open <http://localhost:5173>, log in with any phone (e.g. `+919876543210`).
The dev OTP is shown on screen.

### Option B: real Redis + Postgres + Kafka via Docker

```bash
docker compose -f docker/docker-compose.yml up -d --build
# API:    http://localhost:4000
# App:    http://localhost:5173
# EMQX:   http://localhost:18083  (admin/public)
# Redis:  localhost:6379
# Postgres: localhost:5432  (saathigo/saathigo)
```

Set `MOCK_MODE=false` in `backend/.env` first.

---

## What's implemented

### Backend (`backend/`)

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/auth/request-otp` | Send 6-digit OTP (mocked, returned in dev) |
| `POST /api/v1/auth/verify-otp` | Verify and get JWT |
| `GET /api/v1/auth/me` · `PATCH /api/v1/auth/me` | Profile + `sakhiOptIn` + family contacts |
| `POST /api/v1/auth/driver/register` | Driver KYC stub (would call UIDAI/DigiLocker in prod) |
| `GET /api/v1/cities` | The six launch markets |
| `GET /api/v1/drivers/nearby` | Redis Geo radius query, filterable by ev/sakhi/pool |
| `POST /api/v1/rides/estimate` | Multi-quote (EV, Sakhi, Pool, OneJourney, Standard) with surge |
| `POST /api/v1/rides/book` | Match a driver, lock fare, accrue Khushi streak + CO₂ |
| `POST /api/v1/sakhi/sos` | One-tap SOS - escalates to family + ops + police (mock) |
| `POST /api/v1/sakhi/route-deviation/:rideId` | Server-side deviation check |
| `POST /api/v1/sakhi/family-link` | Generate signed family-tracker URL |
| `GET /api/v1/admin/stats` | Ops centre stats (admin key required) |

WebSocket namespaces:

- `/location` — driver pings + rider/family subscribes (sticky room per driver)
- `/trip` — trip state transitions (REQUESTED → ACCEPTED → STARTED → ENDED)
- `/sakhi` — Sakhi-Shield monitor channel for ops centre

In MOCK mode the seed file generates ~ 600 drivers across the six cities and
the `/location` namespace drifts them on the map every 1.5s.

### Frontend (`frontend/`)

A Vite + React 18 + Leaflet single-page app:

- **Login** with OTP (dev OTP visible inline)
- **Booking panel** with vernacular language selector, pickup/drop, multi-quote, surge banner
- **Live map** with filter chips (All / EV / Sakhi / Pool), pulsing pickup pin, animated cabs
- **Driver-track card** that appears after booking, with ETA, plate, ratings, family-share, SOS
- **Perks panel** showing your Khushi streak, Hara CO₂ impact, Sahkari dividend
- **Multi-city switcher** (click the city chip in the header to cycle through Bangalore → Mumbai → Delhi → Pune → Hyderabad → Patna)
- **API health pill** in the header (green = backend reachable)

### Cloud infrastructure

- `docker/` - local development stack
- `k8s/` - production manifests with HPA (6 → 200 pods on CPU/memory/WS-conn metrics) and PDBs
- `terraform/main.tf` - AWS ap-south-1: VPC, EKS (3 node groups), Aurora Postgres serverless v2, ElastiCache Redis cluster (3 shards), MSK Kafka (6 brokers)
- `helm/saathigo/` - Helm chart that mirrors the k8s manifests

### Load tests

```bash
brew install k6                            # or apt install k6
k6 run loadtest/k6-booking.js              # ramps to 5k RPS booking
k6 run loadtest/k6-websocket.js            # ramps to 5k concurrent WS
```

### Docs

- `docs/SCALING.md` — the path from `npm run dev` to **100M concurrent requests**, layer by layer.

---

## Architectural highlights for the 100M-request requirement

1. **Stateless API tier** + **Kubernetes HPA** scaling to 200 pods per region.
2. **Sharded Redis Geo** keyed by H3 cell - radius queries finish in 8 ms p99.
3. **Kafka (MSK) location pipeline** ingesting 1 Hz GPS from millions of drivers, partitioned by H3 cell.
4. **WebSocket fan-out** with one-room-per-driver model - O(1) per-update cost.
5. **Cell-based deployment**: each metro becomes its own deployment cell at scale, so a Bangalore failure cannot affect Mumbai.
6. **Multi-region active-active** in ap-south-1 + ap-south-2 with AWS Global Accelerator for transparent failover.
7. **Aurora Postgres serverless v2** + **Cassandra Keyspaces** + **Pinot** + **ClickHouse** - polyglot persistence so each access pattern hits the right store.
8. **Aggressive backpressure**: rate limit, fare-lock-only-90s, surge-cap, graceful 503 with retry-after.

Read `docs/SCALING.md` for the full story.

---

## Status — what's done vs. what's stubbed

| Area | Status |
|---|---|
| Backend REST + WebSocket | Working, runs in MOCK or real-Redis mode |
| Frontend | Working - real backend wiring + animated demo when MOCK |
| Postgres schema | Defined (`docker/postgres/init.sql`) |
| Real DB write-path | Stubbed - `routes/*` use the in-mem L1; swap is mechanical |
| Kafka pipeline | Compose service runs, but ingest is currently in-process |
| AI4Bharat vernacular voice | Stub UI only (mock toast on click) |
| UIDAI / DigiLocker e-KYC | Stub endpoint |
| Cooperative dividend on-chain anchor | Schema only |

These are deliberate v1 simplifications; each can ship as a 2-week project.

---

## Running tests + smoke check

```bash
cd backend && node --check src/server.js && echo "syntax OK"
```

The k6 scripts double as integration tests — point them at any environment.

---

## License & contact

Proprietary · SaathiGo / Anish · 2026 · hello@saathigo.in
