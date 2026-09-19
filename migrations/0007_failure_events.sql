-- Failure events from the app (one row per failed network call or handler exception).
CREATE TABLE IF NOT EXISTS failure_events (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  event TEXT NOT NULL,
  error_type TEXT NOT NULL,
  context TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS failure_events_created ON failure_events (created_at);
