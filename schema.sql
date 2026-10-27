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
  email         TEXT,                            -- set once they sign in by email
  username      TEXT,                            -- public @handle, unique
  display_name  TEXT,
  bio           TEXT,
  avatar        INTEGER,                         -- crew member 0-5
  color         TEXT,                            -- profile banner color
  genre         TEXT,
  links         TEXT,                            -- JSON of music/social links
  pinned        TEXT,                            -- signature line
  age_ok        INTEGER,                         -- confirmed 13 or older
  human_until   INTEGER,                         -- passed the bot check until (ms)
  notify        INTEGER NOT NULL DEFAULT 1       -- email notifications on/off
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

-- friends: one row per pair, a < b alphabetically
CREATE TABLE IF NOT EXISTS friends (
  a             TEXT NOT NULL,
  b             TEXT NOT NULL,
  requested_by  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE INDEX IF NOT EXISTS friends_b ON friends(b);

-- head-to-head battles between friends
CREATE TABLE IF NOT EXISTS battles (
  id          TEXT PRIMARY KEY,
  emoji       TEXT,
  prompt      TEXT NOT NULL,
  challenger  TEXT NOT NULL,
  opponent    TEXT NOT NULL,
  c_lines     TEXT,
  o_lines     TEXT,
  c_score     INTEGER,
  o_score     INTEGER,
  status      TEXT NOT NULL DEFAULT 'open',   -- open | done | declined
  created_at  INTEGER NOT NULL,
  done_at     INTEGER
);
CREATE INDEX IF NOT EXISTS battles_c ON battles(challenger);
CREATE INDEX IF NOT EXISTS battles_o ON battles(opponent);

-- site settings (e.g. an auto-generated cookie signing key when SESSION_SECRET isn't set)
CREATE TABLE IF NOT EXISTS settings (
  k  TEXT PRIMARY KEY,
  v  TEXT NOT NULL
);

-- people you've blocked (they can't friend you or battle you)
CREATE TABLE IF NOT EXISTS blocks (
  blocker     TEXT NOT NULL,
  blocked     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);

-- reports on profiles (offensive name, bio, impersonation)
CREATE TABLE IF NOT EXISTS profile_reports (
  target      TEXT NOT NULL,
  reporter    TEXT NOT NULL,
  reason      TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (target, reporter)
);

-- keeps notification emails from piling up (one per key per window)
CREATE TABLE IF NOT EXISTS notify_log (
  k   TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);
