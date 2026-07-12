CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    number TEXT,
    contact_name TEXT,
    status TEXT,
    message TEXT,
    timestamp TEXT,
    notes TEXT,
    tag TEXT
);
CREATE INDEX IF NOT EXISTS idx_calls_timestamp ON calls(timestamp DESC);
