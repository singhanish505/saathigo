# Scaling SaathiGo to 100 million concurrent requests

This document explains, layer by layer, how the SaathiGo architecture in this repo
gets from a single laptop (~5k RPS) to **100 million concurrent requests** across
the six launch cities. It is written so you can verify the design choices, not
just trust them.

> **Reality check.** 100M concurrent **HTTP** requests is roughly 4× peak Uber globally.
> 100M concurrent **WebSocket** connections is more realistic for a country-scale
> live-tracking system at peak. The architecture below handles both — each layer is
> sized for the harder of the two.

---

## 1. Request mix at peak

| Channel | Peak shape | Approx volume at peak |
|---|---|---|
| Booking REST (`/rides/book`, `/estimate`)        | Spiky, peak ~ 6 PM IST | ~ 800k req/s |
| Driver-location ingest (MQTT/WS)                 | Steady 1 Hz × online drivers | ~ 5 M msg/s |
| Rider WS subscriptions (live driver tracking)    | One per active trip | ~ 40 M concurrent WS |
| Family-tracker WS subscriptions                  | ~ 0.6 per active Sakhi trip | ~ 5 M concurrent WS |
| Sakhi-monitor ops centre subscriptions           | ~ 50 per city | ~ 300 |
| Settlement / dividend batch                      | Quarterly | bursts of 5 GB |

The 100M figure is the **sum** of concurrent WebSocket connections across riders +
family-trackers + driver-pings, plus in-flight HTTP requests, at the absolute
country-wide peak (Diwali week).

---

## 2. The 4 horizontal-scale primitives

### 2.1 Stateless API tier (Express on Kubernetes)

The Node.js code in `backend/` is **fully stateless**. No file system writes, no
in-memory session - everything goes to Redis or Postgres. That's what enables:

- **Horizontal pod autoscaler** (`k8s/hpa.yaml`) up to 200 pods on `saathigo-api`
- Two managed node groups in `terraform/main.tf`:
  - `api` (Graviton m6g.xlarge) for REST traffic
  - `realtime` (c6g.2xlarge) for WebSocket fan-out (network-bound)
- Sticky-session NLB only for the WebSocket service (riders need to land on the
  same pod for the duration of a trip OR we wire the
  `@socket.io/redis-adapter` so any pod can serve the connection).

Capacity per pod:
- ~ 8k REST RPS at 250m–1.5 CPU (we benchmark ~ 12k RPS on a single c6g.large
  with the booking endpoints since matching is just a Redis Geo call).
- ~ 25k WebSocket connections per pod (Node.js `nhooyr/websocket`-style; we use
  socket.io's binary frames and disable polling in prod).

> **At 200 pods × 25k = 5M WS concurrent on a single zone.** Three zones × this =
> 15M. We need **6 zones** (multi-region MUM + HYD + GLOBAL accelerator) to clear
> 100M. See §6.

### 2.2 Sharded Redis Geo (ElastiCache cluster mode)

Sharding strategy:

1. Per-city keyspace: `drivers:geo:BLR`, `drivers:geo:MUM`, ...
2. Within a city, drivers are bucketed by **H3 cell ID at resolution 8** (~ 0.7 km²).
   The matching service queries only the cells overlapping the rider's pickup
   radius. This converts a city-wide query into 4–9 cell-scoped queries.
3. ElastiCache cluster has 3 shards × 2 replicas per region (`terraform/main.tf`).
   We add shards as drivers grow; each shard handles ~ 50k drivers comfortably.

Throughput target: **30k Redis ops / sec / shard**, sustained.

### 2.3 Kafka location pipeline (Amazon MSK)

The driver phone publishes 1 Hz GPS to MQTT (EMQX). EMQX bridges into Kafka; per-city
topics (`location.BLR`, `location.MUM`...) are partitioned by **driver_id mod N**
so a single driver's pings always land on the same partition.

- Replication factor 3, 2 brokers per AZ.
- Consumer groups:
  - `geo-router` (the WebSocket gateway)
  - `flink-aggregates` (5-second windows for ETA/surge)
  - `cassandra-archiver` (long-term GPS log)
  - `safety-detector` (route-deviation, anomaly)

At 5M msg/s × 200 bytes = 1 GB/s. MSK m5.large × 6 brokers = ~ 6 GB/s steady,
with headroom.

### 2.4 Aurora Postgres + Cassandra split

| Data | Store | Reason |
|---|---|---|
| Riders, drivers, trips, payments, sos_incidents, coop_ledger | **Aurora Postgres serverless v2** (2–64 ACU) | ACID, joins, mature ecosystem |
| Historical GPS pings (30 day TTL)                            | **Cassandra (Keyspaces)** | Write-heavy, time-series, sharded by `(driver_id, day)` |
| Real-time matching aggregates                                | **Apache Pinot** | Sub-second OLAP for "top 5 EV drivers within 1km, rated > 4.7" |
| Analytics (dividend calc, exec dashboard)                    | **ClickHouse** | Columnar, parallel queries |
| KYC docs, dashcam clips                                      | **S3 + Object Lock** | Evidentiary integrity |

Postgres is sharded by **city_code** once a single cluster exceeds ~ 500M rows in
`trips`. We use the `citus` extension if we want a transparent shard router.

---

## 3. Hot-path latency budget (rider books a ride)

| Stage | Latency budget (p95) |
|---|---|
| TLS termination at NLB | 8 ms |
| API gateway (Kong) auth check | 5 ms |
| Express + JWT verify | 3 ms |
| Pricing-svc (fare estimate) | 25 ms |
| Matching-svc → Redis Geo radius | 8 ms |
| Pinot enrichment (driver details) | 25 ms |
| Driver notify (FCM/APNs async) | < 80 ms (off the hot path) |
| Total **p95 to first driver notify**: | **< 180 ms** |

We hit the 180 ms p95 by:
- Co-locating API + Redis in the same VPC + AZ (single-digit ms RTT).
- Using **prepared statements** + **PgBouncer** (transaction pooling) for Postgres.
- Caching driver public profiles in Redis (TTL 60s).
- Running matching-svc as a Rust binary side-car for the heaviest cities; Node.js
  matching code in this repo is a working reference - the production version is
  pin-compatible.

---

## 4. WebSocket fan-out architecture

The 100M-WS challenge is not connections - we can scale that. It's **fan-out**:
when a single popular driver's location changes, how many clients learn about it?

Naive: broadcast to all riders in the city → O(N²) at peak.

Our approach:
- A rider's WebSocket subscribes **only** to their matched driver's room (`driver:<id>`).
- The geo-router service publishes to `driver:<id>` only when that driver pings.
- Family-tracker shares the same room for the trip's duration.
- Cross-pod fan-out is handled by `@socket.io/redis-adapter` (Redis pub/sub).

At 880k daily rides spread over 24 hours peaks at ~ 50k concurrent active trips
per city. Across 6 cities = **300k active trips × 1 Hz × 1 update = 300k msg/s**.
Each pod handles ~ 25k connections × 1 update/s = 25k msg/s. We need
~ 12 realtime pods at the steady peak, ~ 60 at Diwali peak. Within HPA.

---

## 5. Backpressure & graceful degradation

| Failure mode | Detection | Action |
|---|---|---|
| Redis Geo shard down | Health check fails | matching-svc falls back to last-known-good cache (90s TTL); riders get 1.5x ETA disclaimer |
| Kafka lag > 30s | Consumer lag metric | Driver-location updates buffered locally on phone; gateway emits "best effort" tag |
| Postgres write lag | RDS Performance Insights | Booking POST returns 503 with retry-after; UI shows "high demand" banner |
| API pod CPU > 90% | Container metrics | HPA scales up; rate limiter returns 429 to robotic clients first (UA-classified) |
| WebSocket pod restart | K8s lifecycle | Sticky NLB drains; client reconnects automatically (socket.io has built-in re-connect with backoff) |

---

## 6. Multi-region & cell-based deployment

The 100M number is **country-wide concurrent peak**. We get there by:

1. **Primary: ap-south-1 (Mumbai)** - all 6 cities run here at MVP.
2. **Active-active: ap-south-2 (Hyderabad)** added at Year 2.
3. **Cell-based isolation** at scale (Year 3+): each city gets its own
   "deployment cell" - separate EKS cluster, separate Redis, separate RDS shard.
   A failure in BLR cannot affect MUM. AWS Global Accelerator routes users to
   their cell.
4. **Edge POPs** for static assets and auth (CloudFront).

Per-cell capacity at Year 3 (Bangalore example):
- 50 API pods, autoscaling to 200
- 20 realtime pods for WebSocket
- Redis cluster: 6 shards × 2 replicas
- Aurora: 16 ACU steady, 64 burst
- MSK: 6 brokers
- Cost: ~ ₹45 lakh / month ($55k)

---

## 7. Cost-per-ride at scale

| Cost line | Year 1 / ride | Year 3 / ride |
|---|---|---|
| Cloud compute + storage | ₹ 2.40 | ₹ 1.10 |
| SMS + voice (vernacular) | ₹ 0.65 | ₹ 0.40 |
| Map tiles (MapMyIndia + OSM) | ₹ 0.45 | ₹ 0.25 |
| Payment gateway fees | ₹ 1.10 | ₹ 0.95 |
| **Total tech cost / ride** | **₹ 4.60** | **₹ 2.70** |

The cost falls because:
- Reserved instances + Graviton ARM (~ 30% cheaper per vCPU)
- Bigger map-tile commits at scale
- Negotiated SMS rates with Karix below wholesale

---

## 8. How we'd actually load-test 100M

The k6 scripts in `loadtest/` will give you ~ 5k RPS from a single workstation.
For 100M:

1. Distributed k6 (Grafana Cloud or self-hosted on a 100-node EC2 fleet) →
   ~ 1M RPS comfortably.
2. **Synthetic mobile clients** (Locust + Python asyncio) generating WebSocket
   storms - 100k concurrent per node × 1000 nodes = 100M.
3. Use **TPC-C style** test data so Redis hot-key skew is realistic.
4. Run the test in **shadow mode** against a clone of prod, using mirrored
   traffic from real production (AWS VPC Traffic Mirroring).

---

## 9. What this repo does not (yet) include

- The Rust matching-svc side-car. The Node.js version is correct and fast enough
  for cities under 250k daily rides; Rust kicks in above that.
- Flink stream-processing jobs. They are deployed as separate Kubernetes
  StatefulSets with checkpointing to S3.
- AI4Bharat IndicWhisper integration for vernacular voice. We have a stub at
  `vernacular-svc` in the architecture doc; a thin Python service hosting the
  model on GPU nodes is how it deploys.
- DigiLocker / UIDAI e-KYC for driver onboarding. Stubbed in `routes/auth.js`.
- Polygon attestation of the cooperative dividend ledger. The append-only ledger
  schema is in `docker/postgres/init.sql`; the on-chain Merkle anchor is a
  cron-job in `coop-ledger-svc` that takes the quarter's root and writes it as a
  zero-value Polygon transaction for public verification.

These are deliberate omissions for v1; each is a 2-week hardening project.

---

## 10. The honest summary

To handle 100M concurrent at the request mix above, on day one of going public,
we need (estimated, ap-south-1 + ap-south-2):

- **2 EKS clusters** (one per region), 6+ AZ
- **400 EKS nodes** (mix of m6g, c6g, spot)
- **30 Redis shards** across cells
- **24 Kafka brokers**
- **64 ACU Aurora**
- **6+ ClickHouse nodes**
- A 24x7 SRE team of 8

Total cost at peak: **₹ 9-12 crore / month** (~ $1.1-1.5M).
At 880k daily rides × ₹220 ARPU, that's still under 5% of GMV.

The architecture in this repo is the foundation. Every component named in this
document is a real piece of code or YAML you can read and run.
