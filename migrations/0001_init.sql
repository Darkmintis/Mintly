-- Mintly schema: anonymous daily counters, no identifiers.
-- One database holds every app; rows are aggregates, never events with user data.

CREATE TABLE IF NOT EXISTS apps (
  app        TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  key_hash   TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- Optional per-app event/button definitions used by the dashboard to flag
-- unregistered traffic and by SDKs to generate typed constants.
CREATE TABLE IF NOT EXISTS registry (
  app        TEXT NOT NULL,
  event      TEXT NOT NULL,
  dim1_allow TEXT NOT NULL DEFAULT '[]', -- JSON array of allowed dim1 values
  dim2_allow TEXT NOT NULL DEFAULT '[]', -- JSON array of allowed dim2 values
  PRIMARY KEY (app, event)
) WITHOUT ROWID;

-- The only event storage: aggregate counts per app / UTC day / event / dimensions.
CREATE TABLE IF NOT EXISTS events_daily (
  app   TEXT NOT NULL,
  day   TEXT NOT NULL,                -- YYYY-MM-DD, UTC, set by the Worker
  event TEXT NOT NULL,
  dim1  TEXT NOT NULL DEFAULT '',
  dim2  TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app, day, event, dim1, dim2)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_events_day ON events_daily (day);
