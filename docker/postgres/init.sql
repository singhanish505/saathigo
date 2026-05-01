-- Minimal schema for SaathiGo API.
-- In prod we'd use migrations (e.g. node-pg-migrate).

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  phone        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  kyc_status   TEXT NOT NULL DEFAULT 'pending',
  sakhi_opt_in BOOLEAN NOT NULL DEFAULT false,
  khushi_streak INT NOT NULL DEFAULT 0,
  co2_saved_grams BIGINT NOT NULL DEFAULT 0,
  family_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT UNIQUE,
  city_code       CHAR(3) NOT NULL,
  gender          CHAR(1) NOT NULL,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  trips           INT NOT NULL DEFAULT 0,
  sakhi_verified  BOOLEAN NOT NULL DEFAULT false,
  is_ev           BOOLEAN NOT NULL DEFAULT false,
  coop_member     BOOLEAN NOT NULL DEFAULT false,
  equity_points   BIGINT NOT NULL DEFAULT 0,
  vehicle_plate   TEXT NOT NULL,
  vehicle_model   TEXT,
  vehicle_color   TEXT,
  kyc_status      TEXT NOT NULL DEFAULT 'pending',
  online          BOOLEAN NOT NULL DEFAULT false,
  last_seen       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drivers_city_online ON drivers (city_code, online);

CREATE TABLE IF NOT EXISTS trips (
  id                  TEXT PRIMARY KEY,
  rider_id            TEXT NOT NULL REFERENCES users(id),
  driver_id           TEXT REFERENCES drivers(id),
  city_code           CHAR(3) NOT NULL,
  ride_type           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'REQUESTED',
  pickup_lat          DOUBLE PRECISION NOT NULL,
  pickup_lng          DOUBLE PRECISION NOT NULL,
  drop_lat            DOUBLE PRECISION NOT NULL,
  drop_lng            DOUBLE PRECISION NOT NULL,
  fare_paise          BIGINT NOT NULL,
  driver_share_paise  BIGINT NOT NULL,
  surge               NUMERIC(3,2) NOT NULL,
  co2_saved_grams     INT NOT NULL DEFAULT 0,
  family_token        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trips_rider_recent ON trips (rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_driver_recent ON trips (driver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sos_incidents (
  id            TEXT PRIMARY KEY,
  trip_id       TEXT NOT NULL REFERENCES trips(id),
  rider_id      TEXT NOT NULL,
  driver_id     TEXT,
  city_code     CHAR(3) NOT NULL,
  severity      TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  state         TEXT NOT NULL DEFAULT 'OPEN',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

-- Cooperative ledger - append-only
CREATE TABLE IF NOT EXISTS coop_ledger (
  id          BIGSERIAL PRIMARY KEY,
  driver_id   TEXT NOT NULL REFERENCES drivers(id),
  trip_id     TEXT REFERENCES trips(id),
  event_type  TEXT NOT NULL,    -- TRIP_EARN | DIVIDEND | EQUITY_VEST
  paise       BIGINT NOT NULL,
  equity_points INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coop_driver ON coop_ledger (driver_id, created_at DESC);
