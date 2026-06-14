CREATE TABLE IF NOT EXISTS users (
  google_id   TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id  TEXT,
  name       TEXT    NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  time       INTEGER NOT NULL DEFAULT 0,
  cleared    INTEGER NOT NULL DEFAULT 0,
  max_combo  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (google_id) REFERENCES users(google_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_google ON leaderboard(google_id);
