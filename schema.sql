-- Wackometer database (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  created_at    INTEGER NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'free',   -- free | pro
  pro_until     INTEGER,                         -- ms timestamp, null = not pro
  credits       INTEGER NOT NULL DEFAULT 0,
  stripe_customer TEXT,
  handle        TEXT,                            -- public display name for leaderboards
  streak        INTEGER NOT NULL DEFAULT 0,
  last_daily    TEXT,                            -- YYYY-MM-DD of last Daily W entry
  email         TEXT                             -- set once they sign in by email
);

CREATE TABLE IF NOT EXISTS readings (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT,
  excerpt     TEXT NOT NULL,
  raw         INTEGER NOT NULL,
  score       INTEGER NOT NULL,
  tier        INTEGER NOT NULL,
  metrics     TEXT NOT NULL,                     -- JSON
  vote_count  INTEGER NOT NULL DEFAULT 0,
  reports     INTEGER NOT NULL DEFAULT 0,
  hidden      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS readings_new ON readings(hidden, created_at DESC);
CREATE INDEX IF NOT EXISTS readings_top ON readings(hidden, vote_count DESC);

CREATE TABLE IF NOT EXISTS votes (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  tier        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (reading_id, user_id)
);
CREATE INDEX IF NOT EXISTS votes_reading ON votes(reading_id);

CREATE TABLE IF NOT EXISTS reports (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (reading_id, user_id)
);

CREATE TABLE IF NOT EXISTS usage (
  user_id  TEXT NOT NULL,
  day      TEXT NOT NULL,
  wingman  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS daily_entries (
  day         TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  lines       TEXT NOT NULL,
  score       INTEGER NOT NULL,
  tier        INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);
CREATE INDEX IF NOT EXISTS daily_board ON daily_entries(day, score ASC);

-- crowd "fire" votes on Daily W entries
CREATE TABLE IF NOT EXISTS daily_likes (
  day         TEXT NOT NULL,
  entry_user  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  PRIMARY KEY (day, entry_user, user_id)
);

-- emoji reactions on Wall posts
CREATE TABLE IF NOT EXISTS reactions (
  reading_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  PRIMARY KEY (reading_id, user_id, emoji)
);

-- Pass the Pen: songs written one line at a time by different people
CREATE TABLE IF NOT EXISTS pens (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  created_by  TEXT NOT NULL,
  line_count  INTEGER NOT NULL DEFAULT 0,
  closed      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pen_lines (
  pen_id      TEXT NOT NULL,
  idx         INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  handle      TEXT,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (pen_id, idx)
);
CREATE INDEX IF NOT EXISTS pen_lines_user ON pen_lines(user_id);

-- email sign-in links
CREATE TABLE IF NOT EXISTS login_tokens (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- simple daily counters for what people do (shares, saves, swaps)
CREATE TABLE IF NOT EXISTS events (
  day    TEXT NOT NULL,
  type   TEXT NOT NULL,
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, type)
);
